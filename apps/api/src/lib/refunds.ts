import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { formatPaise } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, payments, refunds } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { sendEmail } from './email.js'
import type { GatewayRefundEvent } from './gateway.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Refunds.
 *
 * A refund row is written as `pending` BEFORE the gateway is asked, under a
 * lock on the order row. Pending and processed rows both count against what is
 * left to refund, so two staff members (or a double click) can never refund
 * more than was captured, even while the gateway call is in flight.
 *
 * A row only ever moves pending → processed or pending → failed, and that move
 * is conditional on it still being pending. Whichever of the admin request and
 * the gateway webhook gets there first wins; the other is a no-op, so the
 * customer is emailed once.
 *
 * Stock is not touched (a physical return restocks) and shipments are not
 * cancelled: a refund is money, not fulfilment.
 * ──────────────────────────────────────────────────────────────────────────── */

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type RefundRow = typeof refunds.$inferSelect
type PaymentRow = typeof payments.$inferSelect

/** The payment money can be refunded from: one the gateway captured. */
export async function capturedPayment(orderId: string, tx: Tx | typeof db = db): Promise<PaymentRow | null> {
  const [row] = await tx
    .select()
    .from(payments)
    .where(
      and(eq(payments.orderId, orderId), inArray(payments.status, ['captured', 'refunded']), isNotNull(payments.providerPaymentId)),
    )
    .orderBy(asc(payments.createdAt))
    .limit(1)
  return row ?? null
}

export interface RefundTotals {
  /** Paise the gateway captured. */
  captured: number
  /** Paise the gateway has confirmed refunding. */
  refunded: number
  /** Paise asked for and not yet confirmed. */
  pending: number
  /** What may still be refunded: captured − refunded − pending. */
  refundable: number
}

export async function refundTotals(paymentId: string, captured: number, tx: Tx | typeof db = db): Promise<RefundTotals> {
  const rows = await tx
    .select({ status: refunds.status, total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
    .from(refunds)
    .where(eq(refunds.paymentId, paymentId))
    .groupBy(refunds.status)
  const sum = (status: RefundRow['status']) => rows.find((r) => r.status === status)?.total ?? 0
  const refunded = sum('processed')
  const pending = sum('pending')
  return { captured, refunded, pending, refundable: Math.max(0, captured - refunded - pending) }
}

export type SettleOutcome =
  | { status: 'processed'; providerRefundId: string | null }
  | { status: 'failed'; reason: string; providerRefundId?: string }

export interface SettleResult {
  /** False when the row was no longer pending: someone else settled it first. */
  changed: boolean
  /** True when this settlement refunded the last of the captured amount. */
  fullyRefunded: boolean
  /** Whether the customer email went out. Null when none was due from this call. */
  emailed: boolean | null
}

/**
 * Moves a pending refund to processed or failed. On the processed refund that
 * brings the total to the captured amount, the order and payment become
 * `refunded`. Emails the customer about a processed refund.
 */
export async function settleRefund(refundId: string, outcome: SettleOutcome, log: FastifyBaseLogger): Promise<SettleResult> {
  const settled = await db.transaction(async (tx) => {
    const [current] = await tx.select().from(refunds).where(eq(refunds.id, refundId))
    if (!current) return null
    // Same lock as the admin request takes, so totals are read consistently.
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, current.orderId)).for('update')
    const [row] = await tx
      .update(refunds)
      .set(
        outcome.status === 'processed'
          ? { status: 'processed', processedAt: new Date(), failureReason: null, ...(outcome.providerRefundId ? { providerRefundId: outcome.providerRefundId } : {}) }
          : { status: 'failed', failureReason: outcome.reason, ...(outcome.providerRefundId ? { providerRefundId: outcome.providerRefundId } : {}) },
      )
      .where(and(eq(refunds.id, refundId), eq(refunds.status, 'pending')))
      .returning()
    if (!row) return null
    const fullyRefunded = row.status === 'processed' ? await markRefundedIfComplete(tx, row) : false
    return { row, fullyRefunded }
  })
  if (!settled) return { changed: false, fullyRefunded: false, emailed: null }

  const { row, fullyRefunded } = settled
  if (row.status === 'failed') {
    log.warn({ refundId: row.id, reason: row.failureReason }, 'refund failed at the gateway')
    return { changed: true, fullyRefunded: false, emailed: null }
  }
  log.info({ refundId: row.id, amount: row.amount, fullyRefunded }, 'refund processed')
  const emailed = await sendRefundEmail(row.orderId, row.amount, fullyRefunded).catch((err) => {
    log.error({ err, refundId: row.id }, 'refund email failed')
    return false
  })
  return { changed: true, fullyRefunded, emailed }
}

/** Order and payment become `refunded` once confirmed refunds reach the captured amount. */
async function markRefundedIfComplete(tx: Tx, row: RefundRow): Promise<boolean> {
  const [payment] = await tx.select().from(payments).where(eq(payments.id, row.paymentId))
  if (!payment) return false
  const totals = await refundTotals(payment.id, payment.amount, tx)
  if (totals.refunded < payment.amount) return false
  await tx.update(payments).set({ status: 'refunded' }).where(eq(payments.id, payment.id))
  await tx.update(orders).set({ status: 'refunded' }).where(eq(orders.id, row.orderId))
  return true
}

/**
 * Reconciles a signed refund webhook. Finds the row by the gateway's refund id,
 * or by our row id in the refund notes (when the admin request never heard
 * back). A processed refund we have no row for was made in the Razorpay
 * dashboard: it is recorded, so the order still reflects it.
 *
 * Returns a status for the webhook log; `error` marks one a human should see.
 */
export async function reconcileRefundEvent(
  eventType: string,
  event: GatewayRefundEvent,
  log: FastifyBaseLogger,
): Promise<{ status: string; error?: string }> {
  if (eventType !== 'refund.processed' && eventType !== 'refund.failed') return { status: `ignored_${eventType}` }

  let row = await db.query.refunds.findFirst({ where: eq(refunds.providerRefundId, event.refundId) })
  const noted = event.notes.refund_id
  if (!row && noted && /^[0-9a-f-]{36}$/i.test(noted)) {
    row = await db.query.refunds.findFirst({ where: and(eq(refunds.id, noted), isNull(refunds.providerRefundId)) })
  }

  if (row) {
    const payment = await db.query.payments.findFirst({ where: eq(payments.id, row.paymentId) })
    if (payment?.providerPaymentId !== event.paymentId || row.amount !== event.amount) {
      log.error({ refundId: row.id, gatewayRefundId: event.refundId }, 'refund webhook does not match the recorded refund')
      return { status: 'refund_mismatch', error: `Gateway refund ${event.refundId} does not match refund ${row.id}` }
    }
    const target = eventType === 'refund.processed' ? 'processed' : 'failed'
    if (row.status === target) return { status: `already_${target}` }
    if (row.status !== 'pending') {
      log.error({ refundId: row.id, recorded: row.status, event: eventType }, 'refund webhook contradicts the recorded outcome')
      return { status: 'refund_conflict', error: `Refund ${row.id} is ${row.status} but the gateway sent ${eventType}` }
    }
    const result = await settleRefund(
      row.id,
      target === 'processed'
        ? { status: 'processed', providerRefundId: event.refundId }
        : { status: 'failed', reason: 'Razorpay reported the refund as failed.', providerRefundId: event.refundId },
      log,
    )
    return { status: result.changed ? `refund_${target}` : 'already_settled' }
  }

  if (eventType === 'refund.failed') return { status: 'ignored_unknown_refund' }

  const payment = await db.query.payments.findFirst({ where: eq(payments.providerPaymentId, event.paymentId) })
  if (!payment) return { status: 'unknown_payment', error: `No payment matches ${event.paymentId}` }
  const [inserted] = await db
    .insert(refunds)
    .values({
      orderId: payment.orderId,
      paymentId: payment.id,
      idempotencyKey: `gateway:${event.refundId}`,
      providerRefundId: event.refundId,
      amount: event.amount,
      reason: 'Refunded in the Razorpay dashboard',
    })
    .onConflictDoNothing()
    .returning({ id: refunds.id })
  if (!inserted) return { status: 'already_processed' }
  log.warn({ gatewayRefundId: event.refundId, orderId: payment.orderId }, 'recorded a refund made outside the shop')
  await settleRefund(inserted.id, { status: 'processed', providerRefundId: null }, log)
  return { status: 'refund_recorded' }
}

/** Tells the customer money is on its way back. Never claims it has arrived. */
async function sendRefundEmail(orderId: string, amount: number, fullyRefunded: boolean): Promise<boolean> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
  if (!order) return false
  const result = await sendEmail({
    to: order.email,
    subject: `Refund for order ${order.number}`,
    heading: 'Your refund is on its way',
    body: [
      `We have refunded ${formatPaise(amount)} for order ${order.number} to the account or card you paid with.`,
      'Banks usually take 5–7 working days to show it. If it has not appeared after that, reply to this email and we will chase it with you.',
    ],
    facts: [
      ['Order', order.number],
      ['Refund', formatPaise(amount)],
      ...(fullyRefunded ? ([['Order total refunded', formatPaise(order.total)]] as [string, string][]) : []),
    ],
    action: { label: 'View your order', url: `${env.SITE_URL}/order/${encodeURIComponent(order.number)}` },
  })
  return result.delivered
}

/** What a customer sees of their refunds: confirmed ones, and ones asked for. Failed attempts are staff business. */
export async function customerRefunds(orderId: string) {
  const rows = await db.query.refunds.findMany({
    where: and(eq(refunds.orderId, orderId), inArray(refunds.status, ['pending', 'processed'])),
    orderBy: asc(refunds.createdAt),
  })
  return rows.map((r) => ({
    amount: r.amount,
    status: r.status === 'processed' ? ('processed' as const) : ('requested' as const),
    requestedAt: r.createdAt.toISOString(),
    processedAt: r.processedAt?.toISOString() ?? null,
  }))
}
