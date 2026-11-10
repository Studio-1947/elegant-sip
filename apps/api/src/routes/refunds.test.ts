import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { randomBytes, randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { orders, payments, refunds, users } from '../db/schema-commerce.js'
import { FakeGateway } from '../lib/gateway.js'
import { redis } from '../lib/sessions.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Refunds through the fake gateway: full and partial refunds, the over-refund
 * guard under concurrency, idempotency, gateway failure, and reconciliation by
 * signed webhook. Orders are inserted directly as paid, so the tests do not
 * depend on stock or checkout settings.
 * ──────────────────────────────────────────────────────────────────────────── */

const PASSWORD = 'correct-horse-battery'
const TOTAL = 130_000 // ₹1,300

let app: FastifyInstance
let available = true
let staff = ''
let customer = ''
let customerId = ''
const createdOrders: string[] = []

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(admin: boolean) {
  const email = unique(admin ? 'refund-staff' : 'refund-shopper')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Test Person', email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  return { cookie: `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`, id: user!.id }
}

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
  staff = (await signUp(true)).cookie
  const shopper = await signUp(false)
  customer = shopper.cookie
  customerId = shopper.id
})

afterEach(() => {
  FakeGateway.refundOutcome = 'processed'
})

afterAll(async () => {
  if (available && createdOrders.length) {
    await db.delete(refunds).where(inArray(refunds.orderId, createdOrders))
    await db.delete(orders).where(inArray(orders.id, createdOrders))
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

/** A paid order with a captured payment, owned by the test customer. */
async function paidOrder(status: 'paid' | 'pending_payment' = 'paid') {
  const number = `ES-TEST-${randomBytes(4).toString('hex').toUpperCase()}`
  const [order] = await db
    .insert(orders)
    .values({
      number,
      userId: customerId,
      status,
      email: unique('refund-buyer'),
      shippingName: 'Refund Buyer',
      shippingLine1: '12 Mall Road',
      shippingCity: 'Darjeeling',
      shippingPostalCode: '734101',
      shippingMethod: 'standard',
      subtotal: TOTAL - 3000,
      shippingFee: 3000,
      tax: 6000,
      total: TOTAL,
      paidAt: status === 'paid' ? new Date() : null,
    })
    .returning()
  createdOrders.push(order.id)
  const paymentId = `pay_fake_${randomBytes(9).toString('hex')}`
  const [payment] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      provider: 'fake',
      providerOrderId: `order_fake_${randomBytes(9).toString('hex')}`,
      providerPaymentId: status === 'paid' ? paymentId : null,
      status: status === 'paid' ? 'captured' : 'created',
      amount: TOTAL,
      capturedAt: status === 'paid' ? new Date() : null,
    })
    .returning()
  return { order, payment, paymentId }
}

const refund = (number: string, amount: number, key = randomUUID(), cookie = staff) =>
  app.inject({
    method: 'POST',
    url: `/v1/admin/orders/${number}/refunds`,
    headers: { cookie },
    payload: { amount, reason: 'Customer asked to cancel', idempotencyKey: key },
  })

const ledger = async (number: string) =>
  (await app.inject({ method: 'GET', url: `/v1/admin/orders/${number}/refunds`, headers: { cookie: staff } })).json()

const state = async (orderId: string) => {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
  const payment = await db.query.payments.findFirst({ where: eq(payments.orderId, orderId) })
  return { order: order!.status, payment: payment!.status }
}

const webhook = (body: string, signature: string) =>
  app.inject({
    method: 'POST',
    url: '/v1/webhooks/razorpay',
    headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
    payload: body,
  })

describe('admin refunds', () => {
  it('refunds the whole payment: order and payment become refunded, and cancelling is advised', async () => {
    if (!available) return
    const { order } = await paidOrder()

    const res = await refund(order.number, TOTAL)
    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.refund).toMatchObject({ amount: TOTAL, status: 'processed', reason: 'Customer asked to cancel' })
    expect(body.refund.providerRefundId).toMatch(/^rfnd_fake_/)
    expect(body.ledger).toMatchObject({ captured: TOTAL, refunded: TOTAL, pending: 0, refundable: 0, orderStatus: 'refunded', cancelAdvised: true })
    expect(body.advice).toMatch(/cancel the order/)
    expect(typeof body.emailed).toBe('boolean')
    expect(await state(order.id)).toEqual({ order: 'refunded', payment: 'refunded' })

    // The customer sees the processed refund.
    const view = (await app.inject({ method: 'GET', url: `/v1/orders/${order.number}`, headers: { cookie: customer } })).json()
    expect(view.refunds).toEqual([expect.objectContaining({ amount: TOTAL, status: 'processed' })])

    // Cancelling it now keeps the refunded status and records the cancellation, once.
    const cancel = await app.inject({ method: 'PATCH', url: `/v1/admin/orders/${order.number}`, headers: { cookie: staff }, payload: { status: 'cancelled' } })
    expect(cancel.statusCode).toBe(200)
    expect(cancel.json().refundDue).toBe(false)
    const after = await db.query.orders.findFirst({ where: eq(orders.id, order.id) })
    expect(after?.status).toBe('refunded')
    expect(after?.cancelledAt).not.toBeNull()
    expect((await ledger(order.number)).cancelAdvised).toBe(false)
    const again = await app.inject({ method: 'PATCH', url: `/v1/admin/orders/${order.number}`, headers: { cookie: staff }, payload: { status: 'cancelled' } })
    expect(again.statusCode).toBe(409)

    // Nothing left to refund.
    const extra = await refund(order.number, 100)
    expect(extra.statusCode).toBe(409)
  })

  it('a partial refund leaves the order alone; refunding the rest completes it', async () => {
    if (!available) return
    const { order } = await paidOrder()

    const first = await refund(order.number, 30_000)
    expect(first.statusCode).toBe(201)
    expect(first.json().ledger).toMatchObject({ refunded: 30_000, refundable: TOTAL - 30_000, orderStatus: 'paid', cancelAdvised: false })
    expect(first.json().advice).toBeNull()
    expect(await state(order.id)).toEqual({ order: 'paid', payment: 'captured' })

    const rest = await refund(order.number, TOTAL - 30_000)
    expect(rest.statusCode).toBe(201)
    expect(rest.json().ledger).toMatchObject({ refunded: TOTAL, refundable: 0 })
    expect(await state(order.id)).toEqual({ order: 'refunded', payment: 'refunded' })
    expect((await ledger(order.number)).refunds).toHaveLength(2)
  })

  it('refuses more than remains, with the figure in the message', async () => {
    if (!available) return
    const { order } = await paidOrder()
    await refund(order.number, 100_000)

    const over = await refund(order.number, 40_000)
    expect(over.statusCode).toBe(409)
    expect(over.json().type).toBe('refund_exceeds_remaining')
    expect(over.json().detail).toContain('₹300')
    expect((await ledger(order.number)).refunds).toHaveLength(1)
  })

  it('returns the same refund for a repeated idempotency key and calls the gateway once', async () => {
    if (!available) return
    const { order } = await paidOrder()
    const key = randomUUID()
    const before = FakeGateway.refundRequests.length

    const first = await refund(order.number, 20_000, key)
    const second = await refund(order.number, 20_000, key)
    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(200)
    expect(second.json().replayed).toBe(true)
    expect(second.json().refund.id).toBe(first.json().refund.id)
    expect(FakeGateway.refundRequests.length).toBe(before + 1)

    // The same key for a different amount is a conflict, not a second refund.
    expect((await refund(order.number, 25_000, key)).statusCode).toBe(409)
    expect((await ledger(order.number)).refunded).toBe(20_000)
  })

  it('two refunds submitted at once never exceed the captured amount', async () => {
    if (!available) return
    const { order } = await paidOrder()

    const results = await Promise.all([refund(order.number, TOTAL), refund(order.number, TOTAL), refund(order.number, 80_000)])
    const codes = results.map((r) => r.statusCode).sort()
    expect(codes.filter((c) => c === 201)).toHaveLength(1)
    expect(codes.filter((c) => c === 409)).toHaveLength(2)

    const totals = await ledger(order.number)
    expect(totals.refunded + totals.pending).toBeLessThanOrEqual(TOTAL)
  })

  it('a gateway refusal records a failed refund and leaves the order unchanged', async () => {
    if (!available) return
    const { order } = await paidOrder()
    FakeGateway.refundOutcome = 'failed'

    const res = await refund(order.number, TOTAL)
    expect(res.statusCode).toBe(502)
    expect(res.json().detail).toMatch(/Nothing was refunded/)
    const totals = await ledger(order.number)
    expect(totals.refunds[0]).toMatchObject({ status: 'failed', amount: TOTAL })
    expect(totals.refundable).toBe(TOTAL)
    expect(await state(order.id)).toEqual({ order: 'paid', payment: 'captured' })

    // A failed attempt is not shown to the customer.
    const view = (await app.inject({ method: 'GET', url: `/v1/orders/${order.number}`, headers: { cookie: customer } })).json()
    expect(view.refunds).toEqual([])
  })

  it('refuses an order with no captured payment', async () => {
    if (!available) return
    const { order } = await paidOrder('pending_payment')
    const res = await refund(order.number, 1000)
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('not_refundable')
  })

  it('is staff only', async () => {
    if (!available) return
    const { order } = await paidOrder()
    expect((await refund(order.number, 1000, randomUUID(), customer)).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: `/v1/admin/orders/${order.number}/refunds`, headers: { cookie: customer } })).statusCode).toBe(403)
    expect((await ledger(order.number)).refunds).toHaveLength(0)
  })
})

describe('refund webhooks', () => {
  const gateway = new FakeGateway()

  it('settles a pending refund on refund.processed and ignores the duplicate', async () => {
    if (!available) return
    const { order, paymentId } = await paidOrder()
    FakeGateway.refundOutcome = 'pending'

    const res = await refund(order.number, TOTAL)
    expect(res.statusCode).toBe(201)
    const pending = res.json().refund
    expect(pending.status).toBe('pending')
    expect(res.json().advice).toMatch(/processing/)
    expect(await state(order.id)).toEqual({ order: 'paid', payment: 'captured' })

    // Pending refunds count against what is left.
    expect((await refund(order.number, 100)).statusCode).toBe(409)
    const view = (await app.inject({ method: 'GET', url: `/v1/orders/${order.number}`, headers: { cookie: customer } })).json()
    expect(view.refunds).toEqual([expect.objectContaining({ status: 'requested', processedAt: null })])

    const event = gateway.simulateRefundEvent('refund.processed', { refundId: pending.providerRefundId, paymentId, amount: TOTAL })
    const first = await webhook(event.body, event.signature)
    expect(first.json()).toMatchObject({ received: true, status: 'refund_processed' })
    expect(await state(order.id)).toEqual({ order: 'refunded', payment: 'refunded' })

    const duplicate = await webhook(event.body, event.signature)
    expect(duplicate.json().status).toBe('duplicate')
  })

  it('marks a pending refund failed on refund.failed, freeing the amount', async () => {
    if (!available) return
    const { order, paymentId } = await paidOrder()
    FakeGateway.refundOutcome = 'pending'
    const pending = (await refund(order.number, 50_000)).json().refund

    const event = gateway.simulateRefundEvent('refund.failed', { refundId: pending.providerRefundId, paymentId, amount: 50_000 })
    expect((await webhook(event.body, event.signature)).json().status).toBe('refund_failed')
    const totals = await ledger(order.number)
    expect(totals.refunds[0].status).toBe('failed')
    expect(totals.refundable).toBe(TOTAL)
    expect(await state(order.id)).toEqual({ order: 'paid', payment: 'captured' })
  })

  it('finds a refund the gateway never confirmed by the row id in its notes', async () => {
    if (!available) return
    const { order, paymentId } = await paidOrder()
    FakeGateway.refundOutcome = 'unknown'
    const res = await refund(order.number, TOTAL)
    expect(res.statusCode).toBe(201)
    const pending = res.json().refund
    expect(pending).toMatchObject({ status: 'pending', providerRefundId: null })
    expect(pending.failureReason).toMatch(/Not confirmed/)
    expect(res.json().advice).toMatch(/Razorpay dashboard/)

    const event = gateway.simulateRefundEvent('refund.processed', {
      refundId: `rfnd_fake_${randomBytes(6).toString('hex')}`,
      paymentId,
      amount: TOTAL,
      notes: { refund_id: pending.id, order_number: order.number },
    })
    expect((await webhook(event.body, event.signature)).json().status).toBe('refund_processed')
    const totals = await ledger(order.number)
    expect(totals.refunds[0]).toMatchObject({ status: 'processed', failureReason: null })
    expect(await state(order.id)).toEqual({ order: 'refunded', payment: 'refunded' })
  })

  it('records a refund made in the gateway dashboard', async () => {
    if (!available) return
    const { order, paymentId } = await paidOrder()
    const event = gateway.simulateRefundEvent('refund.processed', { refundId: `rfnd_fake_${randomBytes(6).toString('hex')}`, paymentId, amount: 10_000 })
    expect((await webhook(event.body, event.signature)).json().status).toBe('refund_recorded')
    const totals = await ledger(order.number)
    expect(totals).toMatchObject({ refunded: 10_000, refundable: TOTAL - 10_000 })
    expect(totals.refunds[0].reason).toMatch(/dashboard/)
    expect((await webhook(event.body, event.signature)).json().status).toBe('duplicate')
  })

  it('rejects an unsigned refund event', async () => {
    if (!available) return
    const { paymentId } = await paidOrder()
    const event = gateway.simulateRefundEvent('refund.processed', { refundId: 'rfnd_forged', paymentId, amount: TOTAL })
    expect((await webhook(event.body, 'not-the-signature')).statusCode).toBe(401)
  })
})
