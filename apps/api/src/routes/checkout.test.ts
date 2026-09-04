import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orders, stockLedger } from '../db/schema-commerce.js'
import { FakeGateway } from '../lib/gateway.js'
import { redis } from '../lib/sessions.js'
import { expirePendingOrders } from './orders.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Checkout, end to end, against a live database and the fake gateway.
 *
 * This exercises the path that actually matters: price from the catalogue,
 * reserve stock in a transaction, receive a signed webhook, capture, decrement.
 * Because the fake gateway signs with the same HMAC scheme as Razorpay, the
 * signature and idempotency logic under test is the real logic — not a mock.
 *
 * Requires the docker-compose stack. Skips itself if the database is absent so
 * a CI job without services does not report a false failure.
 * ──────────────────────────────────────────────────────────────────────────── */

const SLUG = 'first-flush-fannings'
const SIZE = 'Basic · 100 g'

let app: FastifyInstance
let available = true

const SEED_STOCK = 20

/** The exact variant under test — not merely the product's first row. */
const variantRow = async () => {
  const rows = await db
    .select({ id: productVariants.id, stock: productVariants.stock, price: productVariants.price, size: productVariants.size })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(products.slug, SLUG))
  const row = rows.find((r) => r.size === SIZE)
  if (!row) throw new Error(`Seed data missing: ${SLUG} / ${SIZE}`)
  return row
}

const stockFor = async (_slug?: string) => variantRow()

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(async () => {
  if (!available) return
  const v = await variantRow()
  await db.update(productVariants).set({ stock: SEED_STOCK }).where(eq(productVariants.id, v.id))
})

const order = (overrides: Record<string, unknown> = {}) => ({
  items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 2 }],
  email: 'buyer@example.com',
  shipping: {
    name: 'Test Buyer',
    line1: '12 Mall Road',
    city: 'Darjeeling',
    postalCode: '734101',
    state: 'West Bengal',
    country: 'India' as const,
  },
  shippingMethod: 'standard' as const,
  ...overrides,
})

describe('checkout', () => {
  it('prices from the catalogue and ignores any price sent by the client', async () => {
    if (!available) return
    const before = await stockFor(SLUG)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: order({
        items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 2, unitPrice: 1, lineTotal: 1 }],
      }),
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // ₹100 × 2 = ₹200 goods, ₹150 shipping, 5% of ₹350 = ₹17.50 → ₹18 rounded.
    expect(body.order.subtotal).toBe(before.price * 2)
    expect(body.order.shippingFee).toBe(15000)
    expect(body.order.total).toBe(body.order.subtotal + body.order.shippingFee + body.order.tax)
    expect(body.order.status).toBe('pending_payment')
    // Every total lands on a whole rupee.
    expect(body.order.total % 100).toBe(0)
  })

  it('requires the opaque guest token to read a guest order', async () => {
    if (!available) return
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    expect(created.statusCode).toBe(200)
    const body = created.json()
    expect(body.guestAccessToken).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const denied = await app.inject({ method: 'GET', url: `/v1/orders/${body.order.number}` })
    expect(denied.statusCode).toBe(404)

    const allowed = await app.inject({
      method: 'GET',
      url: `/v1/orders/${body.order.number}`,
      headers: { 'x-order-access-token': body.guestAccessToken },
    })
    expect(allowed.statusCode).toBe(200)
  })

  it('returns the original order on an idempotent checkout retry', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const headers = {
      // The suite points at the developer database. A fixed key would reuse a
      // checkout from a previous test run and falsely look like no stock moved.
      'idempotency-key': randomUUID(),
      'x-guest-access-token': `guest_access_token_for_idempotency_test_${randomUUID()}`,
    }
    const first = await app.inject({ method: 'POST', url: '/v1/orders', headers, payload: order() })
    const retry = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers,
      // A stale retry must return the original checkout, not price this new body.
      payload: order({ items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 1 }] }),
    })

    expect(first.statusCode).toBe(200)
    expect(retry.statusCode).toBe(200)
    expect(retry.json().order.number).toBe(first.json().order.number)
    expect(retry.json().payment.gatewayOrderId).toBe(first.json().payment.gatewayOrderId)
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)
  })

  it('reserves stock inside the order transaction', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const res = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    expect(res.statusCode).toBe(200)
    const after = await stockFor(SLUG)
    expect(after.stock).toBe(before.stock - 2)

    const ledger = await db
      .select()
      .from(stockLedger)
      .where(eq(stockLedger.reason, 'order_reserved'))
    expect(ledger.length).toBeGreaterThan(0)
  })

  it('expires an abandoned checkout and restores stock exactly once', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    const placed = created.json().order
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)

    await db.update(orders).set({ placedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(orders.number, placed.number))
    expect(await expirePendingOrders(new Date(Date.now() - 30 * 60_000))).toBe(1)
    expect(await expirePendingOrders(new Date(Date.now() - 30 * 60_000))).toBe(0)

    const expired = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(expired?.status).toBe('cancelled')
    expect((await stockFor(SLUG)).stock).toBe(before.stock)
  })

  it('refuses to oversell', async () => {
    if (!available) return
    const current = await stockFor(SLUG)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: order({ items: [{ productSlug: SLUG, variantSize: SIZE, quantity: current.stock + 5 }] }),
    })
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('out_of_stock')

    // The failed attempt must not have moved stock.
    const after = await stockFor(SLUG)
    expect(after.stock).toBe(current.stock)
  })

  it('rejects a coming-soon product', async () => {
    if (!available) return
    const res = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: order({ items: [{ productSlug: 'second-flush', variantSize: '100 g', quantity: 1 }] }),
    })
    expect(res.statusCode).toBe(400)
  })

  it('marks the order paid only on a correctly signed webhook', async () => {
    if (!available) return
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    const { order: placed, payment } = created.json()
    expect(placed.status).toBe('pending_payment')

    const gateway = new FakeGateway()
    const { body, signature } = gateway.simulatePayment(payment.gatewayOrderId, placed.total)

    // Wrong signature changes nothing.
    const forged = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': 'not-the-signature' },
      payload: body,
    })
    expect(forged.statusCode).toBe(401)

    const stillPending = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(stillPending?.status).toBe('pending_payment')

    // Correct signature captures.
    const ok = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
      payload: body,
    })
    expect(ok.statusCode).toBe(200)
    expect(ok.json().status).toBe('order_paid')

    const paid = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(paid?.status).toBe('paid')
    expect(paid?.paidAt).not.toBeNull()
  })

  it('ignores a replayed webhook instead of capturing twice', async () => {
    if (!available) return
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    const { order: placed, payment } = created.json()

    const gateway = new FakeGateway()
    const { body, signature } = gateway.simulatePayment(payment.gatewayOrderId, placed.total)
    const headers = { 'content-type': 'application/json', 'x-razorpay-signature': signature }

    const first = await app.inject({ method: 'POST', url: '/v1/webhooks/razorpay', headers, payload: body })
    const second = await app.inject({ method: 'POST', url: '/v1/webhooks/razorpay', headers, payload: body })

    expect(first.json().status).toBe('order_paid')
    // Razorpay retries by design; the second delivery must be a no-op.
    expect(second.json().status).toBe('duplicate')
  })

  it('refuses to capture when the amount does not match the order', async () => {
    if (!available) return
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    const { order: placed, payment } = created.json()

    const gateway = new FakeGateway()
    // A gateway reporting less than we charged must never mark the order paid.
    const { body, signature } = gateway.simulatePayment(payment.gatewayOrderId, placed.total - 10000)

    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
      payload: body,
    })
    expect(res.json().status).toBe('amount_mismatch')

    const unpaid = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(unpaid?.status).toBe('pending_payment')
  })

  it('returns stock when a payment fails', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const created = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    const { order: placed, payment } = created.json()

    const reserved = await stockFor(SLUG)
    expect(reserved.stock).toBe(before.stock - 2)

    const failure = JSON.stringify({
      event: 'payment.failed',
      payload: { payment: { entity: { id: `pay_fail_${Date.now()}`, order_id: payment.gatewayOrderId, amount: placed.total } } },
    })
    const { createHmac } = await import('node:crypto')
    const signature = createHmac('sha256', 'fake-webhook-secret').update(failure).digest('hex')

    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': signature },
      payload: failure,
    })
    expect(res.json().status).toBe('order_cancelled')

    const restored = await stockFor(SLUG)
    expect(restored.stock).toBe(before.stock)
  })
})
