import { and, asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { formatPaise, paiseSchema, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, refunds, users } from '../db/schema-commerce.js'
import { getGateway } from '../lib/gateway.js'
import { ApiError } from '../lib/problem.js'
import { capturedPayment, refundTotals, settleRefund, type RefundTotals } from '../lib/refunds.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — refunds through the payment gateway.
 *
 * Staff refund all or part of a captured payment from the order. The row is
 * reserved (pending) under a lock on the order before the gateway is called,
 * so concurrent requests cannot together exceed what was captured. See
 * lib/refunds.ts. Registered inside admin.ts, so the admin hook covers it.
 * ──────────────────────────────────────────────────────────────────────────── */

const refundDto = z.object({
  id: z.string().uuid(),
  amount: paiseSchema,
  status: z.enum(['pending', 'processed', 'failed']),
  reason: z.string(),
  /** Why it failed, or why a pending refund is unconfirmed. */
  failureReason: z.string().nullable(),
  providerRefundId: z.string().nullable(),
  requestedBy: z.string().nullable(),
  createdAt: z.iso.datetime(),
  processedAt: z.iso.datetime().nullable(),
})

const totalsDto = z.object({
  captured: paiseSchema,
  refunded: paiseSchema,
  pending: paiseSchema,
  refundable: paiseSchema,
})

const ledgerDto = totalsDto.extend({
  orderStatus: z.string(),
  /** The full payment is refunded but the parcel never left: staff should cancel it if it is not being sent. */
  cancelAdvised: z.boolean(),
  refunds: z.array(refundDto),
})

type RefundRow = typeof refunds.$inferSelect
type OrderRow = typeof orders.$inferSelect

const toRefundDto = (row: RefundRow & { requestedByName?: string | null }) => ({
  id: row.id,
  amount: row.amount,
  status: row.status,
  reason: row.reason,
  failureReason: row.failureReason,
  providerRefundId: row.providerRefundId,
  requestedBy: row.requestedByName ?? null,
  createdAt: row.createdAt.toISOString(),
  processedAt: row.processedAt?.toISOString() ?? null,
})

const cancelAdvised = (order: Pick<OrderRow, 'shippedAt' | 'cancelledAt'>, totals: RefundTotals) =>
  totals.captured > 0 && totals.refunded + totals.pending >= totals.captured && !order.shippedAt && !order.cancelledAt

const CANCEL_ADVICE =
  'The whole payment is refunded but this order has not shipped. If you are not sending it, cancel the order as well so its stock is returned.'

export const adminRefundRoutes: FastifyPluginAsyncZod = async (app) => {
  const loadOrder = async (number: string) => {
    const order = await db.query.orders.findFirst({ where: eq(orders.number, number) })
    if (!order) throw ApiError.notFound(`Order ${number}`)
    return order
  }

  const ledger = async (order: OrderRow) => {
    const payment = await capturedPayment(order.id)
    const totals = payment
      ? await refundTotals(payment.id, payment.amount)
      : { captured: 0, refunded: 0, pending: 0, refundable: 0 }
    const rows = await db
      .select({ refund: refunds, requestedByName: users.name })
      .from(refunds)
      .leftJoin(users, eq(users.id, refunds.requestedBy))
      .where(eq(refunds.orderId, order.id))
      .orderBy(asc(refunds.createdAt))
    return {
      ...totals,
      orderStatus: order.status,
      cancelAdvised: cancelAdvised(order, totals),
      refunds: rows.map((r) => toRefundDto({ ...r.refund, requestedByName: r.requestedByName })),
    }
  }

  app.get(
    '/admin/orders/:number/refunds',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Refunds on an order',
        description:
          'What was captured, refunded and is still pending, and every refund attempt. `refundable` is what a new refund may be for. All amounts are paise.',
        params: z.object({ number: z.string().min(3).max(40) }),
        response: { 200: ledgerDto, 401: problemSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request) => ledger(await loadOrder(request.params.number)),
  )

  app.post(
    '/admin/orders/:number/refunds',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Admin'],
        summary: 'Refund all or part of an order',
        description: [
          'Refunds `amount` paise of the captured payment through the payment gateway.',
          '',
          'Idempotent on `idempotencyKey`: repeating a request returns the refund it created (200) and never refunds twice.',
          'The refund is recorded as pending before the gateway is asked, so concurrent requests cannot exceed the captured amount.',
          'When confirmed refunds reach the captured amount the order and payment become `refunded`. Stock and shipments are not touched.',
          '',
          'A gateway refusal records the refund as failed and returns 502; nothing was refunded. When the gateway gives no clear answer the',
          'refund stays pending until its webhook arrives. `emailed` is true only when the customer email was actually sent.',
        ].join('\n'),
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z.object({
          amount: z.number().int().min(1).max(100_000_000),
          reason: z.string().trim().min(3).max(500),
          idempotencyKey: z.string().min(16).max(100),
        }),
        response: {
          200: z.object({ refund: refundDto, ledger: ledgerDto, replayed: z.literal(true), emailed: z.null(), advice: z.string().nullable() }),
          201: z.object({ refund: refundDto, ledger: ledgerDto, replayed: z.literal(false), emailed: z.boolean().nullable(), advice: z.string().nullable() }),
          400: problemSchema,
          401: problemSchema,
          403: problemSchema,
          404: problemSchema,
          409: problemSchema,
          502: problemSchema,
        },
      },
    },
    async (request, reply) => {
      const { amount, reason, idempotencyKey } = request.body
      const order = await loadOrder(request.params.number)

      const replay = async (row: RefundRow) => {
        if (row.orderId !== order.id || row.amount !== amount) {
          throw ApiError.conflict('idempotency_conflict', 'This refund key was already used for a different refund. Reload and try again.')
        }
        const current = await ledger(await loadOrder(order.number))
        return reply.status(200).send({ refund: toRefundDto(row), ledger: current, replayed: true as const, emailed: null, advice: null })
      }

      const existing = await db.query.refunds.findFirst({ where: eq(refunds.idempotencyKey, idempotencyKey) })
      if (existing) return replay(existing)

      const payment = await capturedPayment(order.id)
      if (!payment?.providerPaymentId) {
        throw ApiError.conflict('not_refundable', 'This order has no captured payment, so there is nothing to refund.')
      }

      const reserved = await db.transaction(async (tx): Promise<{ replay: RefundRow } | { row: RefundRow }> => {
        // Serialises refunds on this order: the total below cannot change until commit.
        await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, order.id)).for('update')
        const [sameKey] = await tx.select().from(refunds).where(eq(refunds.idempotencyKey, idempotencyKey))
        if (sameKey) return { replay: sameKey }
        const totals = await refundTotals(payment.id, payment.amount, tx)
        if (totals.refundable === 0) {
          throw ApiError.conflict(
            'nothing_to_refund',
            totals.pending > 0
              ? `The rest of this payment already has a refund awaiting confirmation (${formatPaise(totals.pending)}).`
              : 'This payment has already been refunded in full.',
          )
        }
        if (amount > totals.refundable) {
          throw ApiError.conflict(
            'refund_exceeds_remaining',
            `At most ${formatPaise(totals.refundable)} can be refunded on this order (${formatPaise(totals.captured)} paid, ${formatPaise(totals.refunded + totals.pending)} already refunded or pending).`,
          )
        }
        const [row] = await tx
          .insert(refunds)
          .values({ orderId: order.id, paymentId: payment.id, idempotencyKey, amount, reason, requestedBy: request.session!.userId })
          .returning()
        return { row: row! }
      })
      if ('replay' in reserved) return replay(reserved.replay)
      const row = reserved.row

      const gateway = getGateway()
      const result = await gateway
        .refundPayment({
          paymentId: payment.providerPaymentId,
          amount,
          receipt: row.id,
          notes: { order_number: order.number, refund_id: row.id },
        })
        .catch((err: unknown) => {
          request.log.error({ err, refundId: row.id }, 'refund request threw')
          return { status: 'unknown' as const, reason: 'The payment gateway request failed unexpectedly.' }
        })

      let emailed: boolean | null = null
      let advice: string | null = null
      if (result.status === 'processed') {
        emailed = (await settleRefund(row.id, { status: 'processed', providerRefundId: result.refundId }, request.log)).emailed
      } else if (result.status === 'pending') {
        await db.update(refunds).set({ providerRefundId: result.refundId }).where(eq(refunds.id, row.id))
        advice = 'Razorpay accepted the refund and is processing it. The order updates when Razorpay confirms it.'
      } else if (result.status === 'failed') {
        await settleRefund(row.id, { status: 'failed', reason: result.reason }, request.log)
        throw new ApiError(502, 'refund_failed', 'Refund failed', `The refund was not made: ${result.reason} Nothing was refunded.`)
      } else {
        // Money may have moved. The row stays pending (blocking a second refund) until the webhook settles it.
        await db
          .update(refunds)
          .set({ failureReason: `Not confirmed: ${result.reason}` })
          .where(and(eq(refunds.id, row.id), eq(refunds.status, 'pending')))
        request.log.error({ refundId: row.id, orderNumber: order.number, reason: result.reason }, 'refund outcome unknown')
        advice = `Razorpay did not confirm this refund (${result.reason}) Check the Razorpay dashboard before trying again; the order updates if Razorpay reports it.`
      }

      const fresh = await loadOrder(order.number)
      const current = await ledger(fresh)
      const [saved] = await db
        .select({ refund: refunds, requestedByName: users.name })
        .from(refunds)
        .leftJoin(users, eq(users.id, refunds.requestedBy))
        .where(eq(refunds.id, row.id))
      if (current.cancelAdvised) advice = advice ? `${advice} ${CANCEL_ADVICE}` : CANCEL_ADVICE
      return reply.status(201).send({
        refund: toRefundDto({ ...saved.refund, requestedByName: saved.requestedByName }),
        ledger: current,
        replayed: false as const,
        emailed,
        advice,
      })
    },
  )
}
