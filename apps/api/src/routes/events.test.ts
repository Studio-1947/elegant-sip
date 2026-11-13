import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-token-not-real-0123456789'
})

// Records what would have gone to Meta instead of sending it.
const sendMetaEvents = vi.hoisted(() => vi.fn(async () => true))
vi.mock('../lib/meta-capi.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/meta-capi.js')>()),
  sendMetaEvents,
}))

import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { orderItems, orders } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'
import type { MetaServerEvent } from '../lib/meta-capi.js'

/* The relay forwards consented pixel events to Meta, and reports a Purchase
   only for an order that has really been paid, at the order's own value. */

let app: FastifyInstance
let available = true
const PAID_ORDER = `ES-METATEST-${Date.now()}`
const UNPAID_ORDER = `${PAID_ORDER}-U`

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
  const base = {
    email: 'meta-test@example.com',
    shippingName: 'Test',
    shippingLine1: '1 Test Road',
    shippingCity: 'Darjeeling',
    shippingPostalCode: '734101',
    subtotal: 172_200,
    shippingMethod: 'standard',
    shippingFee: 0,
    tax: 0,
    total: 172_200,
  }
  const [paid] = await db.insert(orders).values({ ...base, number: PAID_ORDER, status: 'paid' }).returning({ id: orders.id })
  await db.insert(orders).values({ ...base, number: UNPAID_ORDER, status: 'pending_payment' })
  await db.insert(orderItems).values({
    orderId: paid!.id,
    productSlug: 'first-flush',
    productName: 'First Flush',
    variantSize: '100 g',
    sku: 'TEST',
    imageSrc: '/x.webp',
    unitPrice: 86_100,
    quantity: 2,
    lineTotal: 172_200,
  })
})

afterAll(async () => {
  if (available) {
    await db.delete(orders).where(eq(orders.number, PAID_ORDER))
    await db.delete(orders).where(eq(orders.number, UNPAID_ORDER))
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(() => sendMetaEvents.mockClear())

const post = (payload: Record<string, unknown>, cookie?: string) =>
  app.inject({
    method: 'POST',
    url: '/v1/events/meta',
    payload,
    headers: { 'user-agent': 'TestBrowser/1.0', ...(cookie ? { cookie } : {}) },
  })

/** The relay runs after the reply, so wait for it. */
const sent = async () => {
  await vi.waitFor(() => expect(sendMetaEvents).toHaveBeenCalled())
  return (sendMetaEvents.mock.calls[0] as unknown as [MetaServerEvent[]])[0][0]!
}
/** Long enough for a relay that was going to happen to have happened. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 150))

describe('POST /v1/events/meta', () => {
  it('forwards an event with its ID, data and Meta cookie', async (ctx) => {
    if (!available) return ctx.skip()
    const response = await post(
      { event: 'AddToCart', eventId: 'evt-abc-123', url: 'https://elegantsip.in/shop?x=1', value: 1722, contents: [{ id: 'first-flush', quantity: 2 }] },
      '_fbp=fb.1.1700000000000.42',
    )
    expect(response.statusCode).toBe(204)
    const event = await sent()
    expect(event).toMatchObject({
      event_name: 'AddToCart',
      event_id: 'evt-abc-123',
      event_source_url: 'https://elegantsip.in/shop',
      user_data: { client_user_agent: 'TestBrowser/1.0', fbp: 'fb.1.1700000000000.42' },
      custom_data: { value: 1722, currency: 'INR', content_ids: ['first-flush'], contents: [{ id: 'first-flush', quantity: 2 }] },
    })
  })

  it('reports a paid order at its stored value, whatever the browser claims', async (ctx) => {
    if (!available) return ctx.skip()
    await post({ event: 'Purchase', eventId: 'anything-at-all', url: 'https://elegantsip.in/order', value: 1, order: PAID_ORDER })
    const event = await sent()
    expect(event.event_id).toBe(`purchase-${PAID_ORDER}`)
    expect(event.custom_data).toEqual({
      value: 1722,
      currency: 'INR',
      content_ids: ['first-flush'],
      content_type: 'product_group',
      contents: [{ id: 'first-flush', quantity: 2 }],
      num_items: 2,
      order_id: PAID_ORDER,
    })
  })

  it('sends nothing for an unpaid, unknown or missing order', async (ctx) => {
    if (!available) return ctx.skip()
    for (const order of [UNPAID_ORDER, 'ES-DOES-NOT-EXIST', undefined]) {
      const response = await post({ event: 'Purchase', eventId: 'evt-purchase-x', url: 'https://elegantsip.in/order', order })
      expect(response.statusCode).toBe(204)
    }
    await settle()
    expect(sendMetaEvents).not.toHaveBeenCalled()
  })

  it('rejects events Meta has no name for', async (ctx) => {
    if (!available) return ctx.skip()
    const response = await post({ event: 'PageView', eventId: 'evt-page-1', url: 'https://elegantsip.in/' })
    expect(response.statusCode).toBe(400)
  })
})
