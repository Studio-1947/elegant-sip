import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'
import { provideTestTea, retireTestTea } from '../test-fixtures.js'
import { planOfferChange } from './admin-catalogue.js'

/* Retiring teas and ending offers from the dashboard, against the dev database. */

const SLUG = 'test-catalogue-tea'
const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let shopper = ''
let productId = ''

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(admin: boolean) {
  const email = unique(admin ? 'catalogue-staff' : 'catalogue-shopper')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Test Person', email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  return `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
}

const get = (url: string, cookie = staff) => app.inject({ method: 'GET', url, headers: { cookie } })
const send = (method: 'PATCH' | 'POST', url: string, payload: object, cookie = staff) =>
  app.inject({ method, url, headers: { cookie }, payload })
const retire = (archived: boolean) => send('PATCH', `/v1/admin/products/${SLUG}`, { archived })

const variants = () =>
  db.query.productVariants.findMany({ where: eq(productVariants.productId, productId), orderBy: productVariants.sortOrder })

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  productId = await provideTestTea(SLUG)
  app = await buildApp()
  await app.ready()
  staff = await signUp(true)
  shopper = await signUp(false)
})

afterAll(async () => {
  if (available) await retireTestTea(SLUG)
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('retiring a tea', () => {
  it('takes it off the shop and the checkout, and brings it back exactly as it was', async () => {
    if (!available) return
    await retire(false)
    expect((await get(`/v1/products/${SLUG}`)).statusCode).toBe(200)

    expect((await retire(true)).statusCode).toBe(200)
    const listed = (await get('/v1/products')).json().products.map((p: { slug: string }) => p.slug)
    expect(listed).not.toContain(SLUG)
    expect((await get(`/v1/products/${SLUG}`)).statusCode).toBe(404)
    // Its reviews endpoint keeps answering, for old links.
    expect((await get(`/v1/products/${SLUG}/reviews`)).statusCode).toBe(200)

    const admin = (await get('/v1/admin/products')).json().products.find((p: { slug: string }) => p.slug === SLUG)
    expect(admin.archivedAt).toEqual(expect.any(String))
    expect(admin.variants).toHaveLength(3)

    // Retiring again keeps the original date.
    await retire(true)
    const again = (await get('/v1/admin/products')).json().products.find((p: { slug: string }) => p.slug === SLUG)
    expect(again.archivedAt).toBe(admin.archivedAt)

    const quote = await app.inject({
      method: 'POST',
      url: '/v1/pricing/quote',
      payload: { items: [{ productSlug: SLUG, variantSize: '100 g', quantity: 1 }], shippingMethod: 'standard' },
    })
    expect(quote.statusCode).toBe(400)

    const order = await app.inject({
      method: 'POST',
      url: '/v1/orders',
      remoteAddress: '10.44.0.1',
      headers: { cookie: shopper },
      payload: {
        items: [{ productSlug: SLUG, variantSize: '100 g', quantity: 1 }],
        email: 'buyer@example.com',
        shipping: { name: 'Test Buyer', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India' },
        shippingMethod: 'standard',
      },
    })
    expect(order.statusCode).toBe(409)
    expect(order.json().detail).toMatch(/no longer sold/)

    expect((await retire(false)).statusCode).toBe(200)
    const back = (await get(`/v1/products/${SLUG}`)).json()
    expect(back.archivedAt).toBeNull()
    expect(back.status).toBe('active')
  })

  it('is staff only', async () => {
    if (!available) return
    expect((await get('/v1/admin/products', shopper)).statusCode).toBe(403)
    expect((await send('PATCH', `/v1/admin/products/${SLUG}`, { archived: true }, shopper)).statusCode).toBe(403)
    expect((await send('POST', '/v1/admin/offers', { action: 'end-offer' }, shopper)).statusCode).toBe(403)
  })
})

describe('ending offers', () => {
  it('works out the new prices', () => {
    expect(planOfferChange('end-offer', { price: 75_000, compareAtPrice: 100_000 })).toEqual({ price: 100_000, compareAtPrice: null })
    expect(planOfferChange('clear-compare-at', { price: 75_000, compareAtPrice: 100_000 })).toEqual({ price: 75_000, compareAtPrice: null })
    expect(planOfferChange('end-offer', { price: 75_000, compareAtPrice: null })).toEqual({ price: 75_000, compareAtPrice: null })
  })

  it('previews, then ends the offer on one tea only', async () => {
    if (!available) return
    await provideTestTea(SLUG)
    const [small, medium] = await variants()
    await db.update(productVariants).set({ compareAtPrice: 15_000 }).where(eq(productVariants.id, small.id))
    await db.update(productVariants).set({ compareAtPrice: 26_000 }).where(eq(productVariants.id, medium.id))
    const othersBefore = await db.select({ id: productVariants.id, price: productVariants.price }).from(productVariants)

    const preview = (await get(`/v1/admin/offers/preview?action=end-offer&productSlug=${SLUG}`)).json()
    expect(preview.changes).toEqual([
      expect.objectContaining({ size: '100 g', before: { price: 10_000, compareAtPrice: 15_000 }, after: { price: 15_000, compareAtPrice: null } }),
      expect.objectContaining({ size: '200 g', before: { price: 20_000, compareAtPrice: 26_000 }, after: { price: 26_000, compareAtPrice: null } }),
    ])
    // A preview changes nothing.
    expect((await variants())[0].price).toBe(10_000)

    const applied = await send('POST', '/v1/admin/offers', { action: 'end-offer', productSlug: SLUG })
    expect(applied.statusCode).toBe(200)
    expect(applied.json().changes).toEqual(preview.changes)
    const after = await variants()
    expect(after.map((v) => [v.price, v.compareAtPrice])).toEqual([[15_000, null], [26_000, null], [50_000, null]])

    // No other tea moved.
    const othersAfter = await db.select({ id: productVariants.id, price: productVariants.price }).from(productVariants)
    const mine = new Set(after.map((v) => v.id))
    expect(othersAfter.filter((v) => !mine.has(v.id))).toEqual(othersBefore.filter((v) => !mine.has(v.id)))
  })

  it('can remove only the struck-out price', async () => {
    if (!available) return
    await provideTestTea(SLUG)
    const [small] = await variants()
    await db.update(productVariants).set({ compareAtPrice: 15_000 }).where(eq(productVariants.id, small.id))

    const applied = (await send('POST', '/v1/admin/offers', { action: 'clear-compare-at', productSlug: SLUG })).json()
    expect(applied.changes).toEqual([expect.objectContaining({ after: { price: 10_000, compareAtPrice: null } })])
    expect((await variants())[0]).toMatchObject({ price: 10_000, compareAtPrice: null })
  })

  it('previews every tea without changing any, and 404s an unknown tea', async () => {
    if (!available) return
    const before = await db.select({ id: productVariants.id, price: productVariants.price, c: productVariants.compareAtPrice }).from(productVariants)
    const preview = (await get('/v1/admin/offers/preview?action=end-offer')).json()
    expect(preview.changes.length).toBe(before.filter((v) => v.c !== null).length)
    const after = await db.select({ id: productVariants.id, price: productVariants.price, c: productVariants.compareAtPrice }).from(productVariants)
    expect(after).toEqual(expect.arrayContaining(before))

    expect((await get('/v1/admin/offers/preview?action=end-offer&productSlug=no-such-tea')).statusCode).toBe(404)
    expect((await send('POST', '/v1/admin/offers', { action: 'end-offer', productSlug: 'no-such-tea' })).statusCode).toBe(404)
  })
})

describe('editing the long-form fields', () => {
  it('saves the long description, notes, harvest and brewing card', async () => {
    if (!available) return
    const brewingGuide = { temperature: '85°C', time: '3 minutes', steeps: '2', leafAmount: '2 g per cup', notes: 'Rest the leaf.' }
    const res = await send('PATCH', `/v1/admin/products/${SLUG}`, {
      longDescription: 'A longer story about the test tea.',
      tastingNotes: ['muscatel', 'honey'],
      harvestLabel: 'Spring 2026',
      brewingGuide,
    })
    expect(res.statusCode).toBe(200)
    const row = await db.query.products.findFirst({ where: eq(products.slug, SLUG) })
    expect(row).toMatchObject({ longDescription: 'A longer story about the test tea.', tastingNotes: ['muscatel', 'honey'], harvestLabel: 'Spring 2026', brewingGuide })
  })
})
