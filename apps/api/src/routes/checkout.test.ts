import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orders, stockLedger, storeSettings, users } from '../db/schema-commerce.js'
import { FakeGateway } from '../lib/gateway.js'
import { redis } from '../lib/sessions.js'
import { provideTestTea, retireTestTea } from '../test-fixtures.js'
import { invalidateStoreSettings } from '../lib/settings.js'
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

// A test tea of its own: staff can retire real teas at any time.
const SLUG = 'test-checkout-tea'
const SIZE = '100 g'

let app: FastifyInstance
let available = true
let buyerCookie = ''

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
  await provideTestTea(SLUG)
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  if (available) await retireTestTea(SLUG)
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(async () => {
  if (!available) return
  const v = await variantRow()
  await db.update(productVariants).set({ stock: SEED_STOCK }).where(eq(productVariants.id, v.id))
  const email = `checkout.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Checkout Buyer', email, password: 'correct-horse-battery' } })
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: 'correct-horse-battery' } })
  const session = login.cookies.find((cookie) => cookie.name === 'es_session')
  if (!session) throw new Error('Checkout test sign-in did not return a session')
  buyerCookie = `es_session=${session.value}`
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

/* Checkout keeps its own 20-a-minute limit per address even under test, so
   each call comes from a fresh address; otherwise the file's length decides
   which test hits 429. */
let checkoutCount = 0
const checkout = (payload = order(), headers: Record<string, string> = {}) =>
  app.inject({
    method: 'POST',
    url: '/v1/orders',
    headers: { cookie: buyerCookie, ...headers },
    payload,
    remoteAddress: `10.20.${Math.floor(++checkoutCount / 250)}.${checkoutCount % 250}`,
  })

/* Guest checkout is a shop setting. The tests that depend on it set it, and
   the original value is put back afterwards: the suite shares the dev database. */
let guestCheckoutBefore: boolean | null = null
async function setGuestCheckout(enabled: boolean) {
  if (guestCheckoutBefore === null) {
    const [row] = await db.select({ on: storeSettings.guestCheckoutEnabled }).from(storeSettings).where(eq(storeSettings.id, 1))
    guestCheckoutBefore = row?.on ?? false
  }
  await db.update(storeSettings).set({ guestCheckoutEnabled: enabled }).where(eq(storeSettings.id, 1))
  invalidateStoreSettings()
}

afterAll(async () => {
  if (available && guestCheckoutBefore !== null) {
    await db.update(storeSettings).set({ guestCheckoutEnabled: guestCheckoutBefore }).where(eq(storeSettings.id, 1))
  }
})

const guestCheckout = (headers: Record<string, string> = {}, payload = order()) =>
  app.inject({
    method: 'POST',
    url: '/v1/orders',
    headers,
    payload,
    remoteAddress: `10.21.${Math.floor(++checkoutCount / 250)}.${checkoutCount % 250}`,
  })

describe('guest checkout', () => {
  it('refuses a guest while guest checkout is switched off, and takes no stock', async () => {
    if (!available) return
    await setGuestCheckout(false)
    const before = await stockFor(SLUG)
    const res = await guestCheckout()
    expect(res.statusCode).toBe(401)
    expect(res.json()).toMatchObject({ type: 'unauthenticated', detail: 'Sign in before checking out.' })
    expect((await stockFor(SLUG)).stock).toBe(before.stock)
  })

  it('accepts a guest when switched on; only the token holder can read the order', async () => {
    if (!available) return
    await setGuestCheckout(true)
    const res = await guestCheckout()
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.guestAccessToken).toEqual(expect.any(String))
    expect(body.guestAccessToken.length).toBeGreaterThanOrEqual(40)
    const row = await db.query.orders.findFirst({ where: eq(orders.number, body.order.number) })
    expect(row?.userId).toBeNull()

    const url = `/v1/orders/${body.order.number}`
    expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404)
    expect((await app.inject({ method: 'GET', url, headers: { 'x-order-access-token': 'x'.repeat(43) } })).statusCode).toBe(404)
    const read = await app.inject({ method: 'GET', url, headers: { 'x-order-access-token': body.guestAccessToken } })
    expect(read.statusCode).toBe(200)
    expect(read.json().number).toBe(body.order.number)
  })

  it('keeps the browser’s own guest token across an idempotent retry', async () => {
    if (!available) return
    await setGuestCheckout(true)
    const headers = { 'idempotency-key': randomUUID(), 'x-guest-access-token': `guest_retry_token_${randomUUID()}` }
    const first = await guestCheckout(headers)
    const retry = await guestCheckout(headers)
    expect(first.statusCode).toBe(200)
    expect(retry.statusCode).toBe(200)
    expect(first.json().guestAccessToken).toBe(headers['x-guest-access-token'])
    expect(retry.json().order.number).toBe(first.json().order.number)
    // Without the token, the same key does not hand the order to someone else.
    const stranger = await guestCheckout({ 'idempotency-key': headers['idempotency-key'] })
    expect(stranger.statusCode).toBe(409)
  })

  it('still gives a signed-in buyer an account order, with no guest token, while guest checkout is on', async () => {
    if (!available) return
    await setGuestCheckout(true)
    const res = await checkout()
    expect(res.statusCode).toBe(200)
    expect(res.json().guestAccessToken).toBeNull()
  })
})

describe('checkout', () => {
  it('prices from the catalogue and ignores any price sent by the client', async () => {
    if (!available) return
    const before = await stockFor(SLUG)

    const res = await checkout(order({
      items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 2, unitPrice: 1, lineTotal: 1 }],
      billing: { name: 'Invoice Buyer', line1: '8 Chowrasta Road', city: 'Darjiling', postalCode: '734101', state: 'West Bengal', country: 'India' },
    }))

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // ₹100 × 2 = ₹200 goods + ₹30 shipping = ₹230, GST-inclusive (₹11 of it is GST).
    expect(body.order.subtotal).toBe(before.price * 2)
    expect(body.order.shippingFee).toBe(3000)
    expect(body.order.total).toBe(body.order.subtotal + body.order.shippingFee)
    expect(body.order.status).toBe('pending_payment')
    expect(body.order.billing).toMatchObject({ name: 'Invoice Buyer', line1: '8 Chowrasta Road' })
    // Every total lands on a whole rupee.
    expect(body.order.total % 100).toBe(0)
  })

  it('requires sign-in before an order can be placed while guest checkout is off', async () => {
    if (!available) return
    await setGuestCheckout(false)
    const denied = await app.inject({ method: 'POST', url: '/v1/orders', payload: order() })
    expect(denied.statusCode).toBe(401)
    expect(denied.json().detail).toBe('Sign in before checking out.')
    const created = await checkout()
    expect(created.statusCode).toBe(200)
    const body = created.json()
    const allowed = await app.inject({
      method: 'GET',
      url: `/v1/orders/${body.order.number}`,
      headers: { cookie: buyerCookie },
    })
    expect(allowed.statusCode).toBe(200)
  })

  it('refuses a WhatsApp placeholder email as the order contact', async () => {
    if (!available) return
    const res = await checkout(order({ email: 'whatsapp-916200301989@whatsapp.elegantsip.invalid' }))
    expect(res.statusCode).toBe(400)
    expect(JSON.stringify(res.json().errors)).toContain('order updates')
  })

  it('tells the browser whether the account email and name are real', async () => {
    if (!available) return
    const me = (await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { cookie: buyerCookie } })).json()
    expect(me.user).toMatchObject({ emailIsPlaceholder: false, nameIsPlaceholder: false, phone: null })
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
    const first = await checkout(order(), headers)
    const retry = await checkout(
      // A stale retry must return the original checkout, not price this new body.
      order({ items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 1 }] }), headers)

    expect(first.statusCode).toBe(200)
    expect(retry.statusCode).toBe(200)
    expect(retry.json().order.number).toBe(first.json().order.number)
    expect(retry.json().payment.gatewayOrderId).toBe(first.json().payment.gatewayOrderId)
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)
  })

  it('reserves stock inside the order transaction', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const res = await checkout()
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
    const created = await checkout()
    const placed = created.json().order
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)

    await db.update(orders).set({ placedAt: new Date(Date.now() - 31 * 60_000) }).where(eq(orders.number, placed.number))
    expect(await expirePendingOrders(new Date(Date.now() - 30 * 60_000), app.log)).toBe(1)
    expect(await expirePendingOrders(new Date(Date.now() - 30 * 60_000), app.log)).toBe(0)

    const expired = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(expired?.status).toBe('cancelled')
    expect((await stockFor(SLUG)).stock).toBe(before.stock)
  })

  it('refuses to oversell', async () => {
    if (!available) return
    const current = await stockFor(SLUG)
    const res = await checkout(order({ items: [{ productSlug: SLUG, variantSize: SIZE, quantity: current.stock + 5 }] }))
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('out_of_stock')

    // The failed attempt must not have moved stock.
    const after = await stockFor(SLUG)
    expect(after.stock).toBe(current.stock)
  })

  it('rejects a coming-soon product', async () => {
    if (!available) return
    const res = await checkout(order({ items: [{ productSlug: 'chamomile', variantSize: '100 g', quantity: 1 }] }))
    expect(res.statusCode).toBe(400)
  })

  it('marks the order paid only on a correctly signed webhook', async () => {
    if (!available) return
    const created = await checkout()
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
    const created = await checkout()
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
    const created = await checkout()
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

  const verify = (number: string, response: { orderId: string; paymentId: string; signature: string }) =>
    app.inject({
      method: 'POST',
      url: `/v1/orders/${number}/payment/verify`,
      headers: { cookie: buyerCookie },
      payload: {
        razorpay_order_id: response.orderId,
        razorpay_payment_id: response.paymentId,
        razorpay_signature: response.signature,
      },
    })

  it('marks the order paid when checkout returns a valid signature for a captured payment', async () => {
    if (!available) return
    const { order: placed, payment } = (await checkout()).json()
    const response = new FakeGateway().simulateCheckout(payment.gatewayOrderId, placed.total)

    const res = await verify(placed.number, response)
    expect(res.statusCode).toBe(200)
    expect(res.json().status).toBe('paid')
    const paid = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(paid?.status).toBe('paid')

    // Verifying again, or the webhook arriving later, changes nothing.
    expect((await verify(placed.number, response)).json().status).toBe('paid')
  })

  it('rejects a forged checkout signature and leaves the order pending', async () => {
    if (!available) return
    const { order: placed, payment } = (await checkout()).json()
    const response = new FakeGateway().simulateCheckout(payment.gatewayOrderId, placed.total)

    const res = await verify(placed.number, { ...response, signature: 'f'.repeat(64) })
    expect(res.statusCode).toBe(400)
    expect(res.json().type).toBe('invalid_signature')
    const pending = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(pending?.status).toBe('pending_payment')
  })

  it('does not mark paid when the gateway reports the wrong amount or an uncaptured payment', async () => {
    if (!available) return
    const { order: placed, payment } = (await checkout()).json()
    const gateway = new FakeGateway()

    const short = await verify(placed.number, gateway.simulateCheckout(payment.gatewayOrderId, placed.total - 100))
    expect(short.statusCode).toBe(400)

    const authorised = await verify(placed.number, gateway.simulateCheckout(payment.gatewayOrderId, placed.total, 'authorized'))
    expect(authorised.json().status).toBe('pending')

    const pending = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(pending?.status).toBe('pending_payment')
  })

  it('does not let another account verify payment on someone else\'s order', async () => {
    if (!available) return
    const { order: placed, payment } = (await checkout()).json()
    const response = new FakeGateway().simulateCheckout(payment.gatewayOrderId, placed.total)
    const res = await app.inject({
      method: 'POST',
      url: `/v1/orders/${placed.number}/payment/verify`,
      payload: { razorpay_order_id: response.orderId, razorpay_payment_id: response.paymentId, razorpay_signature: response.signature },
    })
    expect(res.statusCode).toBe(404)
  })

  it('keeps the order payable after one failed attempt, so a retry can still succeed', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const created = await checkout()
    const { order: placed, payment } = created.json()

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
    expect(res.json().status).toBe('attempt_failed')

    // Still pending, stock still held for the retry.
    const row = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(row?.status).toBe('pending_payment')
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)

    // The customer retries in the same Razorpay window and it succeeds.
    const retry = new FakeGateway().simulatePayment(payment.gatewayOrderId, placed.total)
    const paid = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': retry.signature },
      payload: retry.body,
    })
    expect(paid.json().status).toBe('order_paid')
  })

  it('lets staff cancel an unpaid order only through valid transitions, returning its stock', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const placed = (await checkout()).json().order
    const row = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    await db.update(users).set({ role: 'admin' }).where(eq(users.id, row!.userId!))
    const patch = (status: string) =>
      app.inject({ method: 'PATCH', url: `/v1/admin/orders/${placed.number}`, headers: { cookie: buyerCookie }, payload: { status } })

    expect((await patch('shipped')).statusCode).toBe(409)
    expect((await patch('cancelled')).statusCode).toBe(200)
    expect((await stockFor(SLUG)).stock).toBe(before.stock)
    // A second cancel is not a second release.
    expect((await patch('cancelled')).statusCode).toBe(200)
    expect((await stockFor(SLUG)).stock).toBe(before.stock)

    // Admin rights follow the database, not the role frozen into the session.
    await db.update(users).set({ role: 'customer' }).where(eq(users.id, row!.userId!))
    expect((await patch('cancelled')).statusCode).toBe(403)
  })

  it('flags a payment that lands after the order expired instead of ignoring it', async () => {
    if (!available) return
    const created = await checkout()
    const { order: placed, payment } = created.json()
    await expirePendingOrders(new Date(Date.now() + 60_000), app.log)

    const late = new FakeGateway().simulatePayment(payment.gatewayOrderId, placed.total)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/webhooks/razorpay',
      headers: { 'content-type': 'application/json', 'x-razorpay-signature': late.signature },
      payload: late.body,
    })
    expect(res.json().status).toBe('refund_required')
    const row = await db.query.orders.findFirst({ where: eq(orders.number, placed.number), with: { payments: true } })
    expect(row?.status).toBe('cancelled')
    expect(row?.payments[0]?.status).toBe('captured')
  })

  it('captures instead of expiring when the customer paid but no confirmation arrived', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const { order: placed, payment } = (await checkout()).json()
    // Paid at Razorpay, but the tab closed and the webhook never came.
    new FakeGateway().simulateCheckout(payment.gatewayOrderId, placed.total, 'captured')

    expect(await expirePendingOrders(new Date(Date.now() + 60_000), app.log)).toBe(0)
    const row = await db.query.orders.findFirst({ where: eq(orders.number, placed.number), with: { payments: true } })
    expect(row?.status).toBe('paid')
    expect(row?.payments[0]?.status).toBe('captured')
    expect((await stockFor(SLUG)).stock).toBe(before.stock - 2)
  })

  it('keeps an order while the gateway cannot be asked, and expires it once it can', async () => {
    if (!available) return
    const before = await stockFor(SLUG)
    const placed = (await checkout()).json().order
    FakeGateway.lookupsFail = true
    try {
      expect(await expirePendingOrders(new Date(Date.now() + 60_000), app.log)).toBe(0)
      const held = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
      expect(held?.status).toBe('pending_payment')
    } finally {
      FakeGateway.lookupsFail = false
    }
    expect(await expirePendingOrders(new Date(Date.now() + 60_000), app.log)).toBe(1)
    const expired = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(expired?.status).toBe('cancelled')
    expect((await stockFor(SLUG)).stock).toBe(before.stock)
  })

  it('still expires an order whose only payment was authorized but never captured', async () => {
    if (!available) return
    const { order: placed, payment } = (await checkout()).json()
    new FakeGateway().simulateCheckout(payment.gatewayOrderId, placed.total, 'authorized')
    expect(await expirePendingOrders(new Date(Date.now() + 60_000), app.log)).toBe(1)
    const row = await db.query.orders.findFirst({ where: eq(orders.number, placed.number) })
    expect(row?.status).toBe('cancelled')
  })
})
