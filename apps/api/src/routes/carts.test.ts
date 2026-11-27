import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'

const { buildApp } = await import('../app.js')
const { db, sql } = await import('../db/client.js')
const { carts, invoices, orders, stockLedger, users } = await import('../db/schema-commerce.js')
const { redis } = await import('../lib/sessions.js')
const { FakeGateway } = await import('../lib/gateway.js')
const { provideTestTea, retireTestTea } = await import('../test-fixtures.js')
const { purgeStaleCarts } = await import('./carts.js')

/* Carts synced from the browser, and the staff list of abandoned ones. */

const TAG = `carts-${Date.now()}`
const SLUG = `${TAG}-tea`
const SIZE = '100 g'
const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let buyer = ''
let buyerEmail = ''
const cartIds: string[] = []
const placed: string[] = []

async function signUp(label: string, admin: boolean) {
  const email = `${TAG}.${label}@example.test`
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: `Cart ${label}`, email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  return { cookie: `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`, email }
}

const newCart = () => {
  const id = randomUUID()
  cartIds.push(id)
  return id
}
const sync = (id: string, quantity: number, opts: { cookie?: string; checkout?: boolean; price?: number } = {}) =>
  app.inject({
    method: 'PUT',
    url: `/v1/carts/${id}`,
    headers: opts.cookie ? { cookie: opts.cookie } : {},
    payload: {
      items: quantity ? [{ productSlug: SLUG, variantSize: SIZE, quantity, ...(opts.price ? { price: opts.price } : {}) }] : [],
      ...(opts.checkout ? { checkout: true } : {}),
    },
  })
const staffCarts = async (query = '') => (await app.inject({ method: 'GET', url: `/v1/admin/carts${query}`, headers: { cookie: staff } })).json()
const findCart = async (id: string, query = '') => (await staffCarts(query)).carts.find((c: { id: string }) => c.id === id)
/** Pretends the shopper last touched the cart this many minutes ago. */
const age = (id: string, minutes: number) => db.update(carts).set({ updatedAt: new Date(Date.now() - minutes * 60_000) }).where(eq(carts.id, id))

async function placeOrder(cartId: string, quantity = 1) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    headers: { cookie: buyer },
    payload: {
      items: [{ productSlug: SLUG, variantSize: SIZE, quantity }],
      email: buyerEmail,
      shipping: { name: 'Cart Buyer', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India', phone: '9876543210' },
      shippingMethod: 'standard',
      cartId,
    },
  })
  expect(res.statusCode, res.body).toBe(200)
  placed.push(res.json().order.number)
  return res.json() as { order: { number: string; total: number }; payment: { gatewayOrderId: string } }
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
  ;({ cookie: staff } = await signUp('staff', true))
  ;({ cookie: buyer, email: buyerEmail } = await signUp('buyer', false))
  await provideTestTea(SLUG)
})

afterAll(async () => {
  if (available) {
    await db.delete(carts).where(inArray(carts.id, cartIds.length ? cartIds : [randomUUID()]))
    const ids = (await db.select({ id: orders.id }).from(orders).where(inArray(orders.number, placed.length ? placed : ['-']))).map((o) => o.id)
    if (ids.length) {
      await db.delete(invoices).where(inArray(invoices.orderId, ids))
      await db.delete(stockLedger).where(inArray(stockLedger.orderId, ids))
      await db.delete(orders).where(inArray(orders.id, ids))
    }
    await retireTestTea(SLUG)
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('cart sync', () => {
  it('stores a server-priced copy and ignores prices from the browser', async () => {
    if (!available) return
    const id = newCart()
    expect((await sync(id, 3, { price: 1 })).statusCode).toBe(204)
    const [row] = await db.select().from(carts).where(eq(carts.id, id))
    expect(row).toMatchObject({ itemCount: 3, subtotal: 30_000, userId: null, orderId: null, checkoutStartedAt: null })
    expect(row.items[0]).toMatchObject({ productSlug: SLUG, variantSize: SIZE, quantity: 3, unitPrice: 10_000 })
  })

  it('attaches a signed-in shopper and records that checkout was opened', async () => {
    if (!available) return
    const id = newCart()
    await sync(id, 1)
    await sync(id, 2, { cookie: buyer, checkout: true })
    const [row] = await db.select().from(carts).where(eq(carts.id, id))
    expect(row.userId).not.toBeNull()
    expect(row.checkoutStartedAt).not.toBeNull()
    // Signing out later does not forget who it was.
    await sync(id, 2)
    expect((await db.select().from(carts).where(eq(carts.id, id)))[0].userId).toBe(row.userId)
  })

  it('does not create a row for an empty cart', async () => {
    if (!available) return
    const id = newCart()
    expect((await sync(id, 0)).statusCode).toBe(204)
    expect(await db.select().from(carts).where(eq(carts.id, id))).toHaveLength(0)
  })

  it('rejects an ID that is not a UUID', async () => {
    if (!available) return
    expect((await sync('not-a-uuid', 1)).statusCode).toBe(400)
  })
})

describe('staff cart list', () => {
  it('is staff only', async () => {
    if (!available) return
    expect((await app.inject({ method: 'GET', url: '/v1/admin/carts', headers: { cookie: buyer } })).statusCode).toBe(403)
  })

  it('shows a recent cart as active and an untouched one as abandoned', async () => {
    if (!available) return
    const id = newCart()
    await sync(id, 2, { cookie: buyer })
    expect(await findCart(id)).toMatchObject({ status: 'active', itemCount: 2, subtotal: 20_000, customer: { email: buyerEmail } })
    await age(id, 61)
    expect(await findCart(id, '?status=abandoned')).toMatchObject({ status: 'abandoned' })
    expect(await findCart(id, '?status=active')).toBeUndefined()
    const { summary } = await staffCarts()
    expect(summary.counts.abandoned).toBeGreaterThanOrEqual(1)
    expect(summary.abandonedValue).toBeGreaterThanOrEqual(20_000)
  })

  it('leaves out a guest cart that was emptied', async () => {
    if (!available) return
    const id = newCart()
    await sync(id, 1)
    await sync(id, 0)
    expect(await findCart(id)).toBeUndefined()
  })

  it('follows a cart into its order: awaiting payment, then left at payment, or ordered once paid', async () => {
    if (!available) return
    const unpaidCart = newCart()
    await sync(unpaidCart, 1, { cookie: buyer, checkout: true })
    const unpaid = await placeOrder(unpaidCart)
    expect(await findCart(unpaidCart)).toMatchObject({ status: 'active', order: { number: unpaid.order.number, status: 'pending_payment' } })
    // Linked carts no longer change.
    await sync(unpaidCart, 5)
    expect((await db.select().from(carts).where(eq(carts.id, unpaidCart)))[0].itemCount).toBe(1)
    await db.update(orders).set({ status: 'cancelled', cancelledAt: new Date() }).where(eq(orders.number, unpaid.order.number))
    expect(await findCart(unpaidCart)).toMatchObject({ status: 'payment_abandoned', customer: { email: buyerEmail } })

    // The browser's copy never arrived: the order still creates the cart.
    const paidCart = newCart()
    const paid = await placeOrder(paidCart, 2)
    const response = new FakeGateway().simulateCheckout(paid.payment.gatewayOrderId, paid.order.total)
    const verified = await app.inject({
      method: 'POST',
      url: `/v1/orders/${paid.order.number}/payment/verify`,
      headers: { cookie: buyer },
      payload: { razorpay_order_id: response.orderId, razorpay_payment_id: response.paymentId, razorpay_signature: response.signature },
    })
    expect(verified.statusCode).toBe(200)
    expect(await findCart(paidCart)).toMatchObject({ status: 'ordered', itemCount: 2, order: { number: paid.order.number, status: 'paid' } })
  })

  it('deletes carts past the retention period, but never one that became an order', async () => {
    if (!available) return
    const stale = newCart()
    await sync(stale, 1)
    await age(stale, 91 * 24 * 60)
    const ordered = newCart()
    await placeOrder(ordered)
    await age(ordered, 91 * 24 * 60)
    await purgeStaleCarts()
    expect(await db.select().from(carts).where(eq(carts.id, stale))).toHaveLength(0)
    expect(await db.select().from(carts).where(eq(carts.id, ordered))).toHaveLength(1)
  })
})
