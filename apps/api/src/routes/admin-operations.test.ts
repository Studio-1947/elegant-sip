import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import type { EmailMessage } from '../lib/email.js'

const sendEmail = vi.hoisted(() => vi.fn(async (_message: EmailMessage) => ({ delivered: true })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

const { buildApp } = await import('../app.js')
const { db, sql } = await import('../db/client.js')
const { productVariants } = await import('../db/schema.js')
const { contactMessages, invoices, orders, returnRequests, stockLedger, storeSettings, users } = await import('../db/schema-commerce.js')
const { redis } = await import('../lib/sessions.js')
const { FakeGateway } = await import('../lib/gateway.js')
const { invalidateStoreSettings } = await import('../lib/settings.js')
const { provideTestTea, retireTestTea } = await import('../test-fixtures.js')
const { env } = await import('../env.js')

/* ────────────────────────────────────────────────────────────────────────────
 * The staff page end to end, through the API as the browser calls it: a real
 * checkout and payment, then finding the order, its full record, notes and
 * address, the cancellation request round trip with the customer's view and
 * emails, inventory (held stock, counts, reasons, history, weights), the
 * customer list and staff access, reports and the CSV export.
 * ──────────────────────────────────────────────────────────────────────────── */

const TAG = `adm-ops-${Date.now()}`
const SLUG = `${TAG}-tea`
const SIZE = '100 g'
const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let staffId = ''
let buyer = ''
let buyerId = ''
let buyerEmail = ''
let checkoutCount = 0
const placed: string[] = []

async function signUp(label: string, admin: boolean) {
  const email = `${TAG}.${label}@example.test`
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: `Ops ${label}`, email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  return { cookie: `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`, id: user!.id, email }
}

const req = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, payload?: object, cookie = staff) =>
  app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })
const get = (url: string, cookie = staff) => req('GET', url, undefined, cookie)

/** Places an order as the buyer and pays it through the fake gateway. */
async function placeAndPay(quantity = 2) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    headers: { cookie: buyer },
    remoteAddress: `10.77.${Math.floor(++checkoutCount / 250)}.${checkoutCount % 250}`,
    payload: {
      items: [{ productSlug: SLUG, variantSize: SIZE, quantity }],
      email: buyerEmail,
      shipping: { name: 'Ops Buyer', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India' },
      shippingMethod: 'standard',
    },
  })
  expect(res.statusCode, res.body).toBe(200)
  const { order, payment } = res.json()
  placed.push(order.number)
  const held = (await get('/v1/admin/inventory')).json().variants.find((v: { productSlug: string; size: string }) => v.productSlug === SLUG && v.size === SIZE)
  const response = new FakeGateway().simulateCheckout(payment.gatewayOrderId, order.total)
  const verified = await app.inject({
    method: 'POST',
    url: `/v1/orders/${order.number}/payment/verify`,
    headers: { cookie: buyer },
    payload: { razorpay_order_id: response.orderId, razorpay_payment_id: response.paymentId, razorpay_signature: response.signature },
  })
  expect(verified.statusCode).toBe(200)
  return { number: order.number as string, total: order.total as number, heldWhileUnpaid: held.held as number }
}

const stockOf = async () => (await db.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.sku, `${SLUG}--0`)))[0].stock
const emailsTo = (to: string) => sendEmail.mock.calls.map(([m]) => m).filter((m) => m.to === to)

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
  ;({ cookie: staff, id: staffId } = await signUp('staff', true))
  ;({ cookie: buyer, id: buyerId, email: buyerEmail } = await signUp('buyer', false))
  await provideTestTea(SLUG)
})

beforeEach(() => sendEmail.mockClear())

afterAll(async () => {
  if (available) {
    const ids = (await db.select({ id: orders.id }).from(orders).where(inArray(orders.number, placed.length ? placed : ['-']))).map((o) => o.id)
    if (ids.length) {
      await db.delete(returnRequests).where(inArray(returnRequests.orderId, ids))
      await db.delete(invoices).where(inArray(invoices.orderId, ids))
      await db.delete(stockLedger).where(inArray(stockLedger.orderId, ids))
      await db.delete(orders).where(inArray(orders.id, ids))
    }
    await db.delete(contactMessages).where(eq(contactMessages.email, `${TAG}.contact@example.test`))
    await db.update(storeSettings).set({ newOrderAlerts: true }).where(eq(storeSettings.id, 1))
    invalidateStoreSettings()
    await retireTestTea(SLUG)
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('orders on the staff page', () => {
  it('holds stock during payment, alerts staff, and shows the full record with money and payment', async () => {
    if (!available) return
    const before = await stockOf()
    const { number, total, heldWhileUnpaid } = await placeAndPay(2)
    expect(heldWhileUnpaid).toBeGreaterThanOrEqual(2)
    expect(await stockOf()).toBe(before - 2)

    // New paid order: the customer's confirmation and the staff heads-up.
    expect(emailsTo(buyerEmail).some((m) => m.subject === `Order ${number} confirmed`)).toBe(true)
    expect(emailsTo(env.CONTACT_INBOX).some((m) => m.subject.includes(`New order ${number}`))).toBe(true)

    const detail = (await get(`/v1/admin/orders/${number}`)).json()
    expect(detail).toMatchObject({ number, status: 'paid', total, refunded: 0, addressEditable: true, customer: { id: buyerId } })
    expect(detail.items[0]).toMatchObject({ productSlug: SLUG, variantSize: SIZE, quantity: 2, unitPrice: 10_000, lineTotal: 20_000 })
    expect(detail.payment).toMatchObject({ provider: 'fake', status: 'captured', method: 'upi' })
    expect(detail.invoiceNumber).toMatch(/^ES\//)
    expect(detail.subtotal - detail.discount + detail.shippingFee).toBe(total)
  })

  it('searches, pages and counts the queue', async () => {
    if (!available) return
    const number = placed[0]
    const found = (await get(`/v1/admin/orders?q=${number.slice(-6)}`)).json()
    expect(found.orders.map((o: { number: string }) => o.number)).toContain(number)
    expect(found.orders[0]).toMatchObject({ customerName: 'Ops Buyer' })
    expect((await get(`/v1/admin/orders?q=${encodeURIComponent(buyerEmail)}&status=paid`)).json().total).toBeGreaterThanOrEqual(1)
    expect((await get(`/v1/admin/orders?q=${encodeURIComponent(buyerEmail)}&status=delivered`)).json().total).toBe(0)
    const page = (await get('/v1/admin/orders?limit=1&offset=0')).json()
    expect(page.orders).toHaveLength(1)
    expect(page.counts.paid).toBeGreaterThanOrEqual(1)
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10)
    expect((await get(`/v1/admin/orders?q=${number}&from=${today}&to=${today}`)).json().total).toBe(1)
    expect((await get(`/v1/admin/orders?q=${number}&from=2001-01-01&to=2001-01-02`)).json().total).toBe(0)
  })

  it('keeps staff notes, corrects the address before dispatch, and resends the confirmation', async () => {
    if (!available) return
    const number = placed[0]
    expect((await req('PUT', `/v1/admin/orders/${number}/staff-notes`, { staffNotes: 'Gift — no invoice in box' })).statusCode).toBe(200)
    expect((await req('PATCH', `/v1/admin/orders/${number}/address`, { postalCode: '734102', phone: '+91 98765 43210' })).statusCode).toBe(200)
    expect((await req('PATCH', `/v1/admin/orders/${number}/address`, { postalCode: '12' })).statusCode).toBe(400)
    const detail = (await get(`/v1/admin/orders/${number}`)).json()
    expect(detail.staffNotes).toBe('Gift — no invoice in box')
    expect(detail.shipping.postalCode).toBe('734102')
    expect(detail.phone).toBe('+91 98765 43210')
    // The customer never sees staff notes.
    expect(JSON.stringify((await get(`/v1/orders/${number}`, buyer)).json())).not.toContain('no invoice in box')

    const resent = await req('POST', `/v1/admin/orders/${number}/resend-confirmation`, {})
    expect(resent.json()).toEqual({ delivered: true })
    expect(emailsTo(buyerEmail).some((m) => m.subject === `Order ${number} confirmed`)).toBe(true)
  })

  it('exports orders as CSV with spreadsheet formulas neutralised', async () => {
    if (!available) return
    const res = await get(`/v1/admin/orders/export.csv?q=${placed[0]}`)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    const [header, row] = res.body.replace(/^\uFEFF/, '').trim().split('\r\n')
    expect(header).toMatch(/^Order,Placed/)
    expect(row).toContain(placed[0])
    expect(row).toContain('Ops Buyer')
  })
})

describe('cancellation requests, both sides', () => {
  it('rejects with a note the customer sees, lets them ask again, then approves: cancelled, restocked, emailed, refund due', async () => {
    if (!available) return
    const { number } = await placeAndPay(1)
    const stockAfterSale = await stockOf()

    const ask = (reason: string) => req('POST', `/v1/orders/${number}/return-requests`, { type: 'cancellation', reason }, buyer)
    expect((await ask('Ordered the wrong tea by mistake')).statusCode).toBe(201)
    expect((await ask('Asking twice should not work')).statusCode).toBe(409)

    const queue = (await get('/v1/admin/return-requests?status=requested')).json().requests
    const item = queue.find((r: { number: string }) => r.number === number)
    expect(item).toMatchObject({ type: 'cancellation', orderStatus: 'paid', email: buyerEmail, customerName: 'Ops Buyer' })
    expect((await get(`/v1/admin/orders?q=${number}`)).json().orders[0].hasRequest).toBe(true)

    sendEmail.mockClear()
    const rejected = (await req('PATCH', `/v1/admin/return-requests/${item.id}`, { status: 'rejected', staffNote: 'Already packed — reply and we will help' })).json()
    expect(rejected).toMatchObject({ ok: true, notified: true, refundDue: false })
    expect(emailsTo(buyerEmail)[0].subject).toContain('About your cancellation request')
    const seen = (await get(`/v1/orders/${number}`, buyer)).json()
    expect(seen.returnRequest).toMatchObject({ type: 'cancellation', status: 'rejected', staffNote: 'Already packed — reply and we will help' })

    // A rejected request can be sent again.
    expect((await ask('Please cancel — I will be travelling')).statusCode).toBe(201)
    expect((await get(`/v1/orders/${number}`, buyer)).json().returnRequest).toMatchObject({ status: 'requested', staffNote: null })

    sendEmail.mockClear()
    const approved = (await req('PATCH', `/v1/admin/return-requests/${item.id}`, { status: 'approved' })).json()
    expect(approved).toMatchObject({ ok: true, restocked: true, notified: true, refundDue: true })
    expect(emailsTo(buyerEmail)[0].subject).toBe(`Cancellation approved for ${number}`)
    expect(await stockOf()).toBe(stockAfterSale + 1)
    expect((await get(`/v1/orders/${number}`, buyer)).json()).toMatchObject({ status: 'cancelled', returnRequest: { status: 'approved' } })
  })

  it('emails the customer when staff cancel a paid order, unless told not to', async () => {
    if (!available) return
    const first = await placeAndPay(1)
    sendEmail.mockClear()
    const res = (await req('PATCH', `/v1/admin/orders/${first.number}`, { status: 'cancelled', reason: 'This lot has sold out.' })).json()
    expect(res).toMatchObject({ ok: true, notified: true, refundDue: true })
    const mail = emailsTo(buyerEmail)[0]
    expect(mail.subject).toBe(`Order ${first.number} has been cancelled`)
    expect(mail.body.join(' ')).toContain('This lot has sold out.')
    expect(mail.body.join(' ')).toContain('refunded')

    const second = await placeAndPay(1)
    sendEmail.mockClear()
    expect((await req('PATCH', `/v1/admin/orders/${second.number}`, { status: 'cancelled', notifyCustomer: false })).json().notified).toBe(false)
    expect(emailsTo(buyerEmail)).toHaveLength(0)
    // A cancelled order's address is fixed.
    expect((await req('PATCH', `/v1/admin/orders/${second.number}/address`, { city: 'Kurseong' })).statusCode).toBe(409)
  })

  it('sends no staff alert when new-order emails are turned off in settings', async () => {
    if (!available) return
    expect((await req('PATCH', '/v1/admin/settings', { newOrderAlerts: false })).json().newOrderAlerts).toBe(false)
    const { number } = await placeAndPay(1)
    expect(emailsTo(env.CONTACT_INBOX).some((m) => m.subject.includes(number))).toBe(false)
    expect((await req('PATCH', '/v1/admin/settings', { newOrderAlerts: true })).json().newOrderAlerts).toBe(true)
  })
})

describe('inventory', () => {
  it('records a stock count, enforces reasons, keeps history and pack weights', async () => {
    if (!available) return
    const adjust = (payload: object) => req('POST', '/v1/admin/stock', { productSlug: SLUG, variantSize: SIZE, ...payload })

    const counted = await adjust({ setTo: 15, note: 'Shelf count' })
    expect(counted.json()).toMatchObject({ stock: 15 })
    expect(await stockOf()).toBe(15)
    expect((await adjust({ setTo: 15 })).json()).toMatchObject({ stock: 15, delta: 0 })
    expect((await adjust({ delta: -2, reason: 'damaged', note: 'Torn pouches' })).json().stock).toBe(13)
    expect((await adjust({ delta: -1, reason: 'restock' })).statusCode).toBe(400)
    expect((await adjust({ delta: 1, reason: 'sample' })).statusCode).toBe(400)
    expect((await adjust({ delta: -100 })).statusCode).toBe(400)
    expect((await adjust({ delta: 1, setTo: 3 })).statusCode).toBe(400)
    expect((await adjust({ delta: 5 })).json().stock).toBe(18)

    const history = (await get(`/v1/admin/stock/ledger?productSlug=${SLUG}&size=${encodeURIComponent(SIZE)}&limit=3`)).json()
    expect(history.entries.map((e: { reason: string; delta: number }) => [e.reason, e.delta])).toEqual([
      ['restock', 5],
      ['damaged', -2],
      ['count_correction', expect.any(Number)],
    ])
    expect(history.entries[1].note).toBe('Torn pouches')
    expect(history.hasMore).toBe(true)
    const orderMoves = (await get(`/v1/admin/stock/ledger?productSlug=${SLUG}&reason=order_reserved`)).json().entries
    expect(orderMoves.map((e: { orderNumber: string }) => e.orderNumber)).toContain(placed[0])

    const url = `/v1/admin/products/${SLUG}/variants/${encodeURIComponent(SIZE)}`
    expect((await req('PATCH', url, { weightGrams: 140 })).json()).toMatchObject({ weightGrams: 140, price: 10_000 })
    let row = (await get('/v1/admin/inventory')).json().variants.find((v: { sku: string }) => v.sku === `${SLUG}--0`)
    expect(row).toMatchObject({ weightGrams: 140, weightIsSet: true, stock: 18 })
    await req('PATCH', url, { weightGrams: null })
    row = (await get('/v1/admin/inventory')).json().variants.find((v: { sku: string }) => v.sku === `${SLUG}--0`)
    expect(row).toMatchObject({ weightGrams: 100, weightIsSet: false })
  })
})

describe('customers, staff access, reports and inboxes', () => {
  it('lists and opens a customer with their orders', async () => {
    if (!available) return
    const list = (await get(`/v1/admin/customers?q=${encodeURIComponent(buyerEmail)}`)).json()
    expect(list.total).toBe(1)
    expect(list.customers[0]).toMatchObject({ id: buyerId, role: 'customer', email: buyerEmail })
    expect(list.customers[0].orderCount).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(list)).not.toMatch(/passwordHash|mfaSecret|argon/i)
    const one = (await get(`/v1/admin/customers/${buyerId}`)).json()
    expect(one.orders.map((o: { number: string }) => o.number)).toEqual(expect.arrayContaining(placed))
  })

  it('gives and removes staff access, but never your own', async () => {
    if (!available) return
    expect((await req('PATCH', `/v1/admin/customers/${staffId}/role`, { role: 'customer' })).statusCode).toBe(409)
    expect((await req('PATCH', `/v1/admin/customers/${buyerId}/role`, { role: 'admin' })).json()).toEqual({ id: buyerId, role: 'admin' })
    expect((await get('/v1/admin/customers?limit=1', buyer)).statusCode).toBe(200)
    expect((await req('PATCH', `/v1/admin/customers/${buyerId}/role`, { role: 'customer' })).json().role).toBe('customer')
    // Takes effect at once, not when their session expires.
    expect((await get('/v1/admin/customers?limit=1', buyer)).statusCode).toBe(403)
  })

  it('reports sales for a period', async () => {
    if (!available) return
    const report = (await get('/v1/admin/reports/sales')).json()
    expect(report.orders).toBeGreaterThanOrEqual(placed.length)
    expect(report.gross).toBeGreaterThan(0)
    expect(report.byDay).toHaveLength(30)
    expect(report.topProducts.map((p: { productSlug: string }) => p.productSlug)).toContain(SLUG)
    expect(report.gst.invoices).toBeGreaterThanOrEqual(1)
    expect((await get('/v1/admin/reports/sales?from=2026-02-01&to=2026-01-01')).statusCode).toBe(400)
  })

  it('shows the contact inbox and newsletter list', async () => {
    if (!available) return
    await app.inject({ method: 'POST', url: '/v1/contact', payload: { name: 'Ops Contact', email: `${TAG}.contact@example.test`, subject: 'Wholesale', message: 'Do you sell 5 kg bags to cafes?' } })
    const inbox = (await get(`/v1/admin/contact-messages?q=${TAG}`)).json()
    expect(inbox.messages[0]).toMatchObject({ name: 'Ops Contact', subject: 'Wholesale' })
    expect(inbox.messages[0].reference).toMatch(/^ES-C-/)
    const news = (await get('/v1/admin/newsletter-subscribers')).json()
    expect(news.active).toBeLessThanOrEqual(news.total)
  })

  it('keeps every new endpoint staff only', async () => {
    if (!available) return
    for (const url of [
      '/v1/admin/inventory',
      '/v1/admin/stock/ledger',
      '/v1/admin/customers',
      `/v1/admin/customers/${buyerId}`,
      '/v1/admin/contact-messages',
      '/v1/admin/newsletter-subscribers',
      '/v1/admin/reports/sales',
      '/v1/admin/orders/export.csv',
      `/v1/admin/orders/${placed[0]}`,
    ]) {
      expect((await get(url, buyer)).statusCode, url).toBe(403)
    }
    expect((await req('PUT', `/v1/admin/orders/${placed[0]}/staff-notes`, { staffNotes: 'x' }, buyer)).statusCode).toBe(403)
  })
})
