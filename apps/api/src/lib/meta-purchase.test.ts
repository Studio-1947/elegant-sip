import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

vi.hoisted(() => {
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-token-not-real-0123456789'
})

// Records what would go to Meta instead of sending it.
const sendMetaEvents = vi.hoisted(() => vi.fn(async () => true))
vi.mock('./meta-capi.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('./meta-capi.js')>()), sendMetaEvents }))

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { orders, users } from '../db/schema-commerce.js'
import { FakeGateway } from './gateway.js'
import type { MetaServerEvent } from './meta-capi.js'
import { redis } from './sessions.js'
import { provideTestTea, retireTestTea } from '../test-fixtures.js'

/* A purchase is reported to Meta from the payment capture — once, only with
   the cookie consent given at checkout, and the visitor details are then deleted. */

const SLUG = 'test-meta-purchase-tea'
let app: FastifyInstance
let available = true
let cookie = ''

beforeAll(async () => {
  try {
    await sql`SELECT 1`
    await redis.ping()
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
  await provideTestTea(SLUG)
  const email = `meta.${Date.now()}@example.test`
  const password = 'correct-horse-battery'
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Meta Buyer', email, password } })
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
  cookie = `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
})

afterAll(async () => {
  if (available) await retireTestTea(SLUG)
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(() => sendMetaEvents.mockClear())

let count = 0
async function checkout(adConsent: boolean) {
  const remoteAddress = `10.77.0.${++count}`
  const placed = await app.inject({
    method: 'POST',
    url: '/v1/orders',
    remoteAddress,
    headers: {
      cookie: `${cookie}; _fbp=fb.1.1700000000000.42`,
      'idempotency-key': randomUUID(),
      'user-agent': 'TestBrowser/2.0',
    },
    payload: {
      items: [{ productSlug: SLUG, variantSize: '100 g', quantity: 1 }],
      email: 'buyer@example.com',
      shipping: { name: 'Test Buyer', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India' },
      shippingMethod: 'standard',
      ...(adConsent ? { adConsent: true } : {}),
    },
  })
  expect(placed.statusCode).toBe(200)
  const { order, payment } = placed.json()
  return { order, payment, remoteAddress }
}

const stored = async (number: string) => (await db.select().from(orders).where(eq(orders.number, number)))[0]!

async function pay(placed: Awaited<ReturnType<typeof checkout>>) {
  const response = new FakeGateway().simulateCheckout(placed.payment.gatewayOrderId, placed.order.total)
  const verified = await app.inject({
    method: 'POST',
    url: `/v1/orders/${placed.order.number}/payment/verify`,
    remoteAddress: placed.remoteAddress,
    headers: { cookie },
    payload: { razorpay_order_id: response.orderId, razorpay_payment_id: response.paymentId, razorpay_signature: response.signature },
  })
  expect(verified.json().status).toBe('paid')
}

describe('purchase reported from the payment capture', () => {
  it('keeps the consent details until payment, reports once, then deletes them', async (ctx) => {
    if (!available) return ctx.skip()
    const placed = await checkout(true)
    const before = await stored(placed.order.number)
    expect(before).toMatchObject({ adConsent: true, metaFbp: 'fb.1.1700000000000.42', metaClientUa: 'TestBrowser/2.0' })
    expect(before.metaClientIp).toBeTruthy()

    await pay(placed)
    await vi.waitFor(() => expect(sendMetaEvents).toHaveBeenCalledTimes(1))
    const event = (sendMetaEvents.mock.calls[0] as unknown as [MetaServerEvent[]])[0][0]!
    expect(event).toMatchObject({
      event_name: 'Purchase',
      event_id: `purchase-${placed.order.number}`,
      user_data: { client_user_agent: 'TestBrowser/2.0', fbp: 'fb.1.1700000000000.42' },
      custom_data: { order_id: placed.order.number, currency: 'INR', num_items: 1 },
    })

    await vi.waitFor(async () => expect((await stored(placed.order.number)).metaClientIp).toBeNull())
    const after = await stored(placed.order.number)
    expect(after.metaPurchaseSentAt).toBeTruthy()
    expect(after).toMatchObject({ metaFbp: null, metaFbc: null, metaClientUa: null })
  })

  it('stores nothing and reports nothing without consent', async (ctx) => {
    if (!available) return ctx.skip()
    const placed = await checkout(false)
    expect(await stored(placed.order.number)).toMatchObject({ adConsent: false, metaFbp: null, metaClientIp: null, metaClientUa: null })
    await pay(placed)
    await new Promise((resolve) => setTimeout(resolve, 200))
    expect(sendMetaEvents).not.toHaveBeenCalled()
  })
})
