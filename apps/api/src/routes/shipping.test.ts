import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

const WEBHOOK_TOKEN = vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  const token = 'test-courier-webhook-token-0123456789'
  process.env.SHIPROCKET_WEBHOOK_TOKEN = token
  return token
})

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orders, users } from '../db/schema-commerce.js'
import { FakeGateway } from '../lib/gateway.js'
import { FakeShippingProvider, __setShippingProvider } from '../lib/shipping.js'
import { nextShipmentStatus, normaliseCourierStatus, normalisePhone, packGrams, syncStaleShipments } from '../lib/fulfilment.js'
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

/** A paid order, ready to ship. */
async function paidOrder(phone?: string) {
  const placed = await app.inject({
    method: 'POST',
    url: '/v1/orders',
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

const admin = (method: 'GET' | 'POST', url: string, payload?: object) =>
  app.inject({ method, url, headers: { cookie }, ...(payload ? { payload } : {}) })

const courierWebhook = (body: object, token = WEBHOOK_TOKEN) =>
  app.inject({ method: 'POST', url: '/v1/webhooks/courier', headers: { 'content-type': 'application/json', 'x-api-key': token }, payload: JSON.stringify(body) })

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
})
