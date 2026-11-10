import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

const WEBHOOK_TOKEN = vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  const token = 'test-courier-webhook-token-0123456789'
  process.env.SHIPROCKET_WEBHOOK_TOKEN = token
  return token
})

// Every email (customer and staff) is recorded instead of sent.
const sendEmail = vi.hoisted(() => vi.fn(async (_message: { to: string; subject: string }) => ({ delivered: false })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orders, users, webhookEvents } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { recordCaptureOnClosedOrder } from '../lib/capture.js'
import { FakeGateway } from '../lib/gateway.js'
import { FakeShippingProvider, __setShippingProvider } from '../lib/shipping.js'
import {
  applyTracking,
  chargeableGrams,
  nextShipmentStatus,
  normaliseCourierStatus,
  normalisePhone,
  packGrams,
  providerOrderRef,
  syncStaleShipments,
} from '../lib/fulfilment.js'
import { redis } from '../lib/sessions.js'

/* Courier booking and tracking, end to end against the fake provider. */

const SLUG = 'first-flush-fannings'
const SIZE = '100 g'

let app: FastifyInstance
let available = true
let cookie = ''

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  __setShippingProvider(new FakeShippingProvider())
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  __setShippingProvider(null)
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(async () => {
  if (!available) return
  const [variant] = await db
    .select({ id: productVariants.id, size: productVariants.size })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(products.slug, SLUG))
    .then((rows) => rows.filter((r) => r.size === SIZE))
  await db.update(productVariants).set({ stock: 50 }).where(eq(productVariants.id, variant.id))

  const email = `ship.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
  const password = 'correct-horse-battery'
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Ship Staff', email, password } })
  // Staff and buyer are the same account here; the role is what matters.
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
  cookie = `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
})

/** Checkout is rate limited per client; each test order comes from its own address. */
let placedCount = 0
const nextAddress = () => `10.31.${Math.floor(++placedCount / 250)}.${placedCount % 250}`

/** A paid order, ready to ship. */
async function paidOrder(phone?: string) {
  const placed = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    remoteAddress: nextAddress(),
    headers: { cookie, 'idempotency-key': randomUUID() },
    payload: {
      items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 3 }],
      email: 'buyer@example.com',
      shipping: {
        name: 'Test Buyer',
        line1: '12 Mall Road',
        city: 'Darjeeling',
        postalCode: '734101',
        state: 'West Bengal',
        country: 'India',
        ...(phone ? { phone } : {}),
      },
      shippingMethod: 'standard',
    },
  })
  expect(placed.statusCode).toBe(200)
  const { order, payment } = placed.json()
  const response = new FakeGateway().simulateCheckout(payment.gatewayOrderId, order.total)
  const verified = await app.inject({
    method: 'POST',
    url: `/v1/orders/${order.number}/payment/verify`,
    headers: { cookie },
    payload: { razorpay_order_id: response.orderId, razorpay_payment_id: response.paymentId, razorpay_signature: response.signature },
  })
  expect(verified.json().status).toBe('paid')
  return order.number as string
}

const admin = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

const courierWebhook = (body: object, token = WEBHOOK_TOKEN) =>
  app.inject({ method: 'POST', url: '/v1/webhooks/courier', headers: { 'content-type': 'application/json', 'x-api-key': token }, payload: JSON.stringify(body) })

const book = (number: string, payload: object = {}) => admin('POST', `/v1/admin/orders/${number}/shipment`, payload)
const setOrderStatus = (number: string, payload: object) => admin('PATCH', `/v1/admin/orders/${number}`, payload)
const orderWithShipment = (number: string) => db.query.orders.findFirst({ where: eq(orders.number, number), with: { shipment: true } })
const customerView = async (number: string) => (await app.inject({ method: 'GET', url: `/v1/orders/${number}`, headers: { cookie } })).json()

/** The order_ids the fake courier was sent for this order. */
const providerRefs = (number: string) =>
  FakeShippingProvider.calls.filter((c) => c.step === 'createOrder' && (c.arg === number || c.arg.startsWith(`${number}-`))).map((c) => c.arg)

const emailsMatching = (pattern: RegExp, to?: string) =>
  sendEmail.mock.calls.filter(([message]) => pattern.test(message.subject) && (!to || message.to === to))

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('fulfilment helpers', () => {
  it('weighs packs, normalises phones and courier statuses', () => {
    expect(packGrams('250 g')).toBe(250)
    expect(packGrams('1 kg')).toBe(1000)
    expect(normalisePhone('+91 98300 12345')).toBe('9830012345')
    expect(normalisePhone('12345')).toBeNull()
    expect(normaliseCourierStatus('PICKED UP')).toBe('in_transit')
    expect(normaliseCourierStatus('Pickup Scheduled')).toBe('pickup_scheduled')
    expect(normaliseCourierStatus('OUT FOR DELIVERY')).toBe('out_for_delivery')
    expect(normaliseCourierStatus('DELIVERED')).toBe('delivered')
    expect(normaliseCourierStatus('RTO INITIATED')).toBe('rto')
    expect(normaliseCourierStatus('something new')).toBeNull()
    // Stale reports never move a parcel backwards; side states still apply.
    expect(nextShipmentStatus('in_transit', 'pickup_scheduled')).toBe('in_transit')
    expect(nextShipmentStatus('in_transit', 'out_for_delivery')).toBe('out_for_delivery')
    expect(nextShipmentStatus('in_transit', 'exception')).toBe('exception')
    expect(nextShipmentStatus('exception', 'in_transit')).toBe('in_transit')
    expect(nextShipmentStatus('delivered', 'rto')).toBe('delivered')
  })

  it('maps realistic Shiprocket statuses', () => {
    const cases: [string, string | null][] = [
      ['NEW', null],
      ['AWB ASSIGNED', 'pickup_scheduled'],
      ['LABEL GENERATED', 'pickup_scheduled'],
      ['PICKUP SCHEDULED', 'pickup_scheduled'],
      ['PICKUP QUEUED', 'pickup_scheduled'],
      ['MANIFEST GENERATED', 'pickup_scheduled'],
      ['OUT FOR PICKUP', 'pickup_scheduled'],
      ['PICKUP RESCHEDULED', 'pickup_scheduled'],
      ['PICKUP EXCEPTION', 'exception'],
      ['PICKED UP', 'in_transit'],
      ['SHIPPED', 'in_transit'],
      ['IN TRANSIT', 'in_transit'],
      ['IN TRANSIT-AT DESTINATION HUB', 'in_transit'],
      ['REACHED AT DESTINATION HUB', 'in_transit'],
      ['DELAYED', 'in_transit'],
      ['OUT FOR DELIVERY', 'out_for_delivery'],
      ['DELIVERED', 'delivered'],
      ['PARTIAL_DELIVERED', null],
      ['UNDELIVERED', 'exception'],
      ['LOST', 'exception'],
      ['DAMAGED', 'exception'],
      ['DISPOSED OFF', 'exception'],
      ['UNTRACEABLE', 'exception'],
      ['RTO INITIATED', 'rto'],
      ['RTO IN TRANSIT', 'rto'],
      ['RTO_OFD', 'rto'],
      ['RTO NDR', 'rto'],
      ['RTO DELIVERED', 'rto'],
      ['RTO_ACKNOWLEDGED', 'rto'],
      ['CANCELED', 'cancelled'],
      ['CANCELLED', 'cancelled'],
      // A request is not yet a cancellation.
      ['CANCELLATION REQUESTED', null],
      ['SELF FULFILED', null],
    ]
    for (const [raw, expected] of cases) expect([raw, normaliseCourierStatus(raw)]).toEqual([raw, expected])
  })

  it('keeps cancelled final and rto sticky', () => {
    expect(nextShipmentStatus('cancelled', 'in_transit')).toBe('cancelled')
    expect(nextShipmentStatus('cancelled', 'delivered')).toBe('cancelled')
    expect(nextShipmentStatus('rto', 'in_transit')).toBe('rto')
    expect(nextShipmentStatus('rto', 'out_for_delivery')).toBe('rto')
    expect(nextShipmentStatus('rto', 'delivered')).toBe('rto')
    expect(nextShipmentStatus('rto', normaliseCourierStatus('RTO DELIVERED'))).toBe('rto')
  })

  it('quotes on volumetric weight and numbers rebookings', () => {
    // Default box 20 × 15 × 10 cm = 3000 cm³ / 5000 = 0.6 kg.
    expect(chargeableGrams(450)).toBe(600)
    expect(chargeableGrams(1200)).toBe(1200)
    expect(providerOrderRef('ES-1', 0)).toBe('ES-1')
    expect(providerOrderRef('ES-1', 1)).toBe('ES-1')
    expect(providerOrderRef('ES-1', 2)).toBe('ES-1-2')
  })

  it('refuses the fake courier in production', () => {
    const run = (provider: string) => {
      const childEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production', PAYMENT_PROVIDER: 'disabled', SHIPPING_PROVIDER: provider }
      delete childEnv.VITEST
      return spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./src/env.ts')"], {
        env: childEnv,
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        encoding: 'utf8',
        timeout: 60_000,
      })
    }
    const fake = run('fake')
    expect(fake.status).toBe(1)
    expect(fake.stderr).toContain('SHIPPING_PROVIDER')
    expect(run('manual').status).toBe(0)
  }, 90_000)
})

describe('courier shipments', () => {
  it('requires a mobile number, then books courier, AWB, pickup and label', async () => {
    if (!available) return
    const number = await paidOrder()

    const blocked = await admin('POST', `/v1/admin/orders/${number}/shipment`, {})
    expect(blocked.statusCode).toBe(409)
    expect(blocked.json().type).toBe('phone_required')

    const rates = await admin('GET', `/v1/admin/orders/${number}/shipment/couriers`)
    expect(rates.statusCode).toBe(200)
    // 3 × 100 g of tea + 150 g packaging.
    expect(rates.json().weightGrams).toBe(450)
    expect(rates.json().couriers.length).toBeGreaterThan(0)

    const booked = await admin('POST', `/v1/admin/orders/${number}/shipment`, { courierId: 2, phone: '+91 98300 12345' })
    expect(booked.statusCode).toBe(200)
    const shipment = booked.json().shipment
    expect(shipment.awb).toMatch(/^FAKE/)
    expect(shipment.courierName).toBe('Fake Air')
    expect(shipment.status).toBe('pickup_scheduled')
    expect(shipment.labelUrl).toBeTruthy()
    // The public tracking link exists from booking, before any courier scan.
    expect(shipment.trackingUrl).toBe(`https://track.example/${shipment.awb}`)

    const order = await db.query.orders.findFirst({ where: eq(orders.number, number) })
    expect(order?.status).toBe('packed')
    expect(order?.shippingPhone).toBe('9830012345')
    expect(order?.trackingNumber).toBe(shipment.awb)

    // Booking again is a no-op, not a second shipment.
    const again = await admin('POST', `/v1/admin/orders/${number}/shipment`, {})
    expect(again.json().shipment.awb).toBe(shipment.awb)
  })

  it('moves the order to shipped on sync and delivered on webhook, and shows the customer tracking', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await admin('POST', `/v1/admin/orders/${number}/shipment`, {})).json()

    FakeShippingProvider.setTracking(shipment.awb, {
      providerStatus: 'IN TRANSIT',
      trackingUrl: 'https://track.example/FAKE',
      expectedDeliveryAt: null,
      scans: [{ at: '2026-11-05T05:00:00.000Z', status: 'Picked Up', location: 'Siliguri', detail: 'Shipment picked up' }],
    })
    const synced = await admin('POST', `/v1/admin/orders/${number}/shipment/sync`)
    expect(synced.json().shipment.status).toBe('in_transit')

    // A lagging tracking lookup must not pull the parcel back to pickup.
    FakeShippingProvider.setTracking(shipment.awb, { providerStatus: 'AWB ASSIGNED', trackingUrl: null, expectedDeliveryAt: null, scans: [] })
    const stale = await admin('POST', `/v1/admin/orders/${number}/shipment/sync`)
    expect(stale.json().shipment.status).toBe('in_transit')
    expect(stale.json().shipment.providerStatus).toBe('IN TRANSIT')
    expect((await db.query.orders.findFirst({ where: eq(orders.number, number) }))?.status).toBe('shipped')

    const denied = await courierWebhook({ awb: shipment.awb, current_status: 'DELIVERED' }, 'wrong-token-wrong-token-wrong-tok')
    expect(denied.statusCode).toBe(401)

    const delivered = {
      awb: shipment.awb,
      current_status: 'DELIVERED',
      current_timestamp: '2026-11-07 15:10:00',
      scans: [{ date: '2026-11-07 15:10:00', activity: 'Delivered to consignee', location: 'Darjeeling', 'sr-status-label': 'DELIVERED' }],
    }
    expect((await courierWebhook(delivered)).json().status).toBe('delivered')
    expect((await courierWebhook(delivered)).json().status).toBe('duplicate')
    expect((await db.query.orders.findFirst({ where: eq(orders.number, number) }))?.status).toBe('delivered')

    const view = (await app.inject({ method: 'GET', url: `/v1/orders/${number}`, headers: { cookie } })).json()
    expect(view.shipment.courierName).toBe('Fake Surface')
    expect(view.shipment.trackingUrl).toBe('https://track.example/FAKE')
    expect(view.shipment.events.map((e: { status: string }) => e.status)).toEqual(['Picked Up', 'DELIVERED'])

    const cancelLate = await admin('POST', `/v1/admin/orders/${number}/shipment/cancel`)
    expect(cancelLate.statusCode).toBe(409)
  })

  it('refreshes silent shipments in the background, as a safety net for missed webhooks', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await admin('POST', `/v1/admin/orders/${number}/shipment`, {})).json()
    FakeShippingProvider.setTracking(shipment.awb, {
      providerStatus: 'OUT FOR DELIVERY',
      trackingUrl: null,
      expectedDeliveryAt: '2026-11-08T12:00:00.000Z',
      scans: [{ at: '2026-11-08T03:00:00.000Z', status: 'Out for delivery', location: 'Darjeeling', detail: null }],
    })

    // Never synced, so it is due whatever the window.
    expect(await syncStaleShipments(180, app.log, 10_000)).toBeGreaterThan(0)
    const view = (await app.inject({ method: 'GET', url: `/v1/orders/${number}`, headers: { cookie } })).json()
    expect(view.status).toBe('shipped')
    expect(view.shipment.status).toBe('out_for_delivery')
    expect(view.shipment.trackingUrl).toBe(`https://track.example/${shipment.awb}`)

    // Just synced: not due again inside the window.
    FakeShippingProvider.setTracking(shipment.awb, { providerStatus: 'DELIVERED', trackingUrl: null, expectedDeliveryAt: null, scans: [] })
    await syncStaleShipments(180, app.log, 10_000)
    expect((await db.query.orders.findFirst({ where: eq(orders.number, number) }))?.status).toBe('shipped')
  })

  it('cancels before pickup and lets staff rebook', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const first = (await admin('POST', `/v1/admin/orders/${number}/shipment`, {})).json().shipment

    const cancelled = await admin('POST', `/v1/admin/orders/${number}/shipment/cancel`)
    expect(cancelled.json().shipment.status).toBe('cancelled')
    expect((await db.query.orders.findFirst({ where: eq(orders.number, number) }))?.trackingNumber).toBeNull()

    const rebooked = (await admin('POST', `/v1/admin/orders/${number}/shipment`, {})).json().shipment
    expect(rebooked.awb).not.toBe(first.awb)
    expect(rebooked.status).toBe('pickup_scheduled')
  })

  it('refuses to ship an unpaid order', async () => {
    if (!available) return
    const placed = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: { cookie, 'idempotency-key': randomUUID() },
      payload: {
        items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 1 }],
        email: 'buyer@example.com',
        shipping: { name: 'Test Buyer', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India', phone: '9830012345' },
        shippingMethod: 'standard',
      },
    })
    const res = await admin('POST', `/v1/admin/orders/${placed.json().order.number}/shipment`, {})
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('order_not_shippable')
  })

  it('quotes rates on volumetric weight but books the actual weight', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const rates = (await admin('GET', `/v1/admin/orders/${number}/shipment/couriers`)).json()
    expect(rates.weightGrams).toBe(450)
    // 600 g volumetric = two 500 g slabs at the fake's ₹45 a slab.
    expect(rates.couriers.find((c: { courierName: string }) => c.courierName === 'Fake Surface').rate).toBe(9000)
    await book(number)
    expect(FakeShippingProvider.calls.find((c) => c.step === 'createOrder' && c.arg === number)?.weightGrams).toBe(450)
  })
})

describe('cancelling orders that have a shipment', () => {
  it('cancels the courier shipment before cancelling the order, and hides it from the customer', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    await book(number)
    const providerOrderId = (await orderWithShipment(number))!.shipment!.providerOrderId!

    const res = await setOrderStatus(number, { status: 'cancelled' })
    expect(res.statusCode).toBe(200)
    const order = await orderWithShipment(number)
    expect(order?.status).toBe('cancelled')
    expect(order?.shipment?.status).toBe('cancelled')
    expect(order?.trackingNumber).toBeNull()
    expect(FakeShippingProvider.calls).toContainEqual({ step: 'cancel', arg: providerOrderId })
    expect((await customerView(number)).shipment).toBeNull()
  })

  it('cancels the shipment when a cancellation request is approved', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    await book(number)
    const requested = await app.inject({
      method: 'POST',
      url: `/v1/orders/${number}/return-requests`,
      headers: { cookie },
      payload: { type: 'cancellation', reason: 'Ordered the wrong tea, sorry' },
    })
    expect(requested.statusCode).toBe(201)
    const approved = await admin('PATCH', `/v1/admin/return-requests/${requested.json().id}`, { status: 'approved' })
    expect(approved.statusCode).toBe(200)
    const order = await orderWithShipment(number)
    expect(order?.status).toBe('cancelled')
    expect(order?.shipment?.status).toBe('cancelled')
  })

  it('leaves the order alone when the courier will not cancel', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    await book(number)
    FakeShippingProvider.failNext('cancel', 'Shiprocket /orders/cancel failed (500): try later')
    const res = await setOrderStatus(number, { status: 'cancelled' })
    expect(res.statusCode).toBe(502)
    const order = await orderWithShipment(number)
    expect(order?.status).toBe('packed')
    expect(order?.shipment?.status).toBe('pickup_scheduled')
    expect(order?.shipment?.bookingStartedAt).toBeNull()
  })

  it('refuses while the parcel is with the courier, and alerts staff once about the problem', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await book(number)).json()
    const alerts = () => emailsMatching(new RegExp(`Courier problem with order ${number}`), env.CONTACT_INBOX).length

    expect((await courierWebhook({ awb: shipment.awb, current_status: 'UNDELIVERED', current_timestamp: '2026-11-06 10:00:00' })).json().status).toBe('exception')
    await courierWebhook({ awb: shipment.awb, current_status: 'UNDELIVERED', current_timestamp: '2026-11-06 18:00:00' })
    expect(alerts()).toBe(1)

    const res = await setOrderStatus(number, { status: 'cancelled' })
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('shipment_in_transit')
    expect((await orderWithShipment(number))?.status).toBe('packed')
  })

  it('refuses while a booking is in progress', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    FakeShippingProvider.delayNext('createOrder', 400)
    const pending = book(number)
    await sleep(150)
    const res = await setOrderStatus(number, { status: 'cancelled' })
    expect(res.statusCode).toBe(409)
    expect(res.json().type).toBe('booking_in_progress')
    expect((await pending).statusCode).toBe(200)
  })

  it('cancels a shipped order only once its parcel is returning (rto), which then stays rto', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await book(number)).json()
    await courierWebhook({ awb: shipment.awb, current_status: 'IN TRANSIT', current_timestamp: '2026-11-06 09:00:00' })
    expect((await orderWithShipment(number))?.status).toBe('shipped')

    const early = await setOrderStatus(number, { status: 'cancelled' })
    expect(early.statusCode).toBe(409)
    expect(early.json().type).toBe('invalid_status_change')

    expect((await courierWebhook({ awb: shipment.awb, current_status: 'RTO INITIATED', current_timestamp: '2026-11-08 09:00:00' })).json().status).toBe('rto')
    // Later return scans and a stray forward scan leave it rto, with one alert.
    expect((await courierWebhook({ awb: shipment.awb, current_status: 'RTO IN TRANSIT', current_timestamp: '2026-11-09 09:00:00' })).json().status).toBe('rto')
    expect((await courierWebhook({ awb: shipment.awb, current_status: 'IN TRANSIT', current_timestamp: '2026-11-09 12:00:00' })).json().status).toBe('rto')
    expect(emailsMatching(new RegExp(`Order ${number} is returning to origin`), env.CONTACT_INBOX)).toHaveLength(1)

    const res = await setOrderStatus(number, { status: 'cancelled' })
    expect(res.statusCode).toBe(200)
    const order = await orderWithShipment(number)
    expect(order?.status).toBe('cancelled')
    expect(order?.shipment?.status).toBe('rto')
    expect((await customerView(number)).shipment).toBeNull()
  })
})

describe('courier booking under retries and races', () => {
  it('lets only one of two concurrent bookings reach the courier', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    FakeShippingProvider.delayNext('createOrder', 300)
    const results = await Promise.all([book(number), book(number)])
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409])
    expect(results.find((r) => r.statusCode === 409)!.json().type).toBe('booking_in_progress')
    const awb = results.find((r) => r.statusCode === 200)!.json().shipment.awb
    expect(providerRefs(number)).toHaveLength(1)
    // The lease is released: a later call is the usual no-op.
    expect((await book(number)).json().shipment.awb).toBe(awb)
  })

  it('sends a new provider order id when rebooking after a cancel', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    await book(number)
    await admin('POST', `/v1/admin/orders/${number}/shipment/cancel`)
    expect((await book(number)).statusCode).toBe(200)
    await admin('POST', `/v1/admin/orders/${number}/shipment/cancel`)
    expect((await book(number)).statusCode).toBe(200)
    expect(providerRefs(number)).toEqual([number, `${number}-2`, `${number}-3`])
  })

  it('sends a new provider order id when the createOrder reply was lost', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    FakeShippingProvider.failNext('createOrder', 'The operation was aborted due to timeout', { applied: true })
    expect((await book(number)).statusCode).toBe(502)
    expect((await book(number)).statusCode).toBe(200)
    expect(providerRefs(number)).toEqual([number, `${number}-2`])
  })

  it('recovers the AWB when the assign reply was lost', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    FakeShippingProvider.failNext('assignAwb', 'The operation was aborted due to timeout', { applied: true })
    expect((await book(number)).statusCode).toBe(502)
    const retried = await book(number)
    expect(retried.statusCode).toBe(200)
    expect(retried.json().shipment.awb).toMatch(/^FAKE/)
    expect(retried.json().shipment.status).toBe('pickup_scheduled')
    const shipmentId = (await orderWithShipment(number))!.shipment!.providerShipmentId!
    expect(FakeShippingProvider.calls.filter((c) => c.step === 'assignAwb' && c.arg === shipmentId)).toHaveLength(1)
  })

  it('still fetches the label when pickup fails, and treats "already in pickup queue" as done', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    FakeShippingProvider.failNext('requestPickup', 'The operation was aborted due to timeout', { applied: true })
    const failed = await book(number)
    expect(failed.statusCode).toBe(502)
    const half = (await orderWithShipment(number))!.shipment!
    expect(half.labelUrl).toBeTruthy()
    expect(half.pickupScheduledAt).toBeNull()
    expect(half.lastError).toContain('timeout')

    const retried = await book(number)
    expect(retried.statusCode).toBe(200)
    expect(retried.json().shipment.status).toBe('pickup_scheduled')
    expect(retried.json().shipment.lastError).toBeNull()
  })

  it('applies concurrent tracking reports to the latest row, not the caller\'s copy', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    await book(number)
    const stale = (await orderWithShipment(number))!.shipment!
    const scan = (at: string, status: string) => ({ at, status, location: 'Siliguri', detail: null })

    await applyTracking(stale, { providerStatus: 'OUT FOR DELIVERY', trackingUrl: null, expectedDeliveryAt: null, scans: [scan('2026-11-08T03:00:00.000Z', 'Out for delivery')] }, app.log)
    // Same old copy, older news: neither the status nor the earlier scan is lost.
    const second = await applyTracking(stale, { providerStatus: 'IN TRANSIT', trackingUrl: null, expectedDeliveryAt: null, scans: [scan('2026-11-07T03:00:00.000Z', 'In transit')] }, app.log)
    expect(second.status).toBe('out_for_delivery')
    expect(second.events.map((e) => e.status)).toEqual(['In transit', 'Out for delivery'])

    await Promise.all([
      applyTracking(stale, { providerStatus: 'OUT FOR DELIVERY', trackingUrl: null, expectedDeliveryAt: null, scans: [scan('2026-11-08T05:00:00.000Z', 'Attempt A')] }, app.log),
      applyTracking(stale, { providerStatus: 'OUT FOR DELIVERY', trackingUrl: null, expectedDeliveryAt: null, scans: [scan('2026-11-08T06:00:00.000Z', 'Attempt B')] }, app.log),
    ])
    expect((await orderWithShipment(number))!.shipment!.events).toHaveLength(4)
    // Moving to shipped emailed the customer exactly once.
    expect(emailsMatching(new RegExp(`Order ${number} has shipped`))).toHaveLength(1)
  })
})

describe('courier webhook', () => {
  it('reprocesses an event that was recorded but never processed', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await book(number)).json()
    const body = { awb: shipment.awb, current_status: 'IN TRANSIT', current_timestamp: '2026-11-06 10:00:00' }
    const eventId = `${shipment.awb}:IN TRANSIT:2026-11-06 10:00:00`
    // An earlier delivery that crashed after being recorded.
    await db.insert(webhookEvents).values({ provider: 'shiprocket', eventId, eventType: 'IN TRANSIT', payload: body })

    expect((await courierWebhook(body)).json().status).toBe('in_transit')
    expect((await db.query.webhookEvents.findFirst({ where: eq(webhookEvents.eventId, eventId) }))?.processedAt).not.toBeNull()
    expect((await orderWithShipment(number))?.status).toBe('shipped')
    expect((await courierWebhook(body)).json().status).toBe('duplicate')
  })

  it('ignores a cancelled shipment\'s old AWB', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const { shipment } = (await book(number)).json()
    await admin('POST', `/v1/admin/orders/${number}/shipment/cancel`)

    const late = await courierWebhook({ awb: shipment.awb, current_status: 'PICKED UP', current_timestamp: '2026-11-06 11:00:00' })
    expect(late.json().status).toBe('unknown_awb')
    const order = await orderWithShipment(number)
    expect(order?.shipment?.status).toBe('cancelled')
    expect(order?.status).toBe('packed')
    expect((await admin('POST', `/v1/admin/orders/${number}/shipment/sync`)).statusCode).toBe(409)
  })
})

describe('staff alerts and manual shipping', () => {
  it('emails the shop inbox when a payment lands on a closed order', async () => {
    if (!available) return
    const orderNumber = `ES-TEST-${randomUUID().slice(0, 8)}`
    await recordCaptureOnClosedOrder({ orderNumber, paymentRowId: randomUUID(), paymentId: 'pay_test_refund' }, app.log)
    expect(emailsMatching(new RegExp(`Refund required for order ${orderNumber}`), env.CONTACT_INBOX)).toHaveLength(1)
  })

  it('emails the customer and stamps shippedAt only on the first manual ship', async () => {
    if (!available) return
    const number = await paidOrder('9830012345')
    const first = await setOrderStatus(number, { status: 'shipped', trackingCarrier: 'India Post', trackingNumber: 'EK123456789IN' })
    expect(first.statusCode).toBe(200)
    const shippedAt = (await orderWithShipment(number))?.shippedAt
    expect(shippedAt).toBeTruthy()

    const corrected = await setOrderStatus(number, { status: 'shipped', trackingNumber: 'EK987654321IN' })
    expect(corrected.statusCode).toBe(200)
    expect(corrected.json().notified).toBe(false)
    const order = await orderWithShipment(number)
    expect(order?.trackingNumber).toBe('EK987654321IN')
    expect(order?.shippedAt?.getTime()).toBe(shippedAt!.getTime())
    expect(emailsMatching(new RegExp(`Order ${number} has shipped`))).toHaveLength(1)
  })
})
