import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products, reviews } from '../db/schema.js'
import { users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'

/* Review moderation and the catalogue checks the admin page relies on. */

const SLUG = 'first-flush-fannings'
const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let customer = ''
const created: string[] = []

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(admin: boolean) {
  const email = unique(admin ? 'staff' : 'shopper')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Test Person', email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  return `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
}

const get = (url: string, cookie = staff) => app.inject({ method: 'GET', url, headers: { cookie } })
const patch = (url: string, payload: object, cookie = staff) => app.inject({ method: 'PATCH', url, headers: { cookie }, payload })

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
  staff = await signUp(true)
  customer = await signUp(false)
})

afterAll(async () => {
  if (available && created.length) await db.delete(reviews).where(inArray(reviews.id, created))
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

async function addReview(body: string, publishedAt: Date | null, createdAt: Date) {
  const product = await db.query.products.findFirst({ where: eq(products.slug, SLUG) })
  const [row] = await db
    .insert(reviews)
    .values({ productId: product!.id, authorName: 'Test Reader', rating: 4, body, verified: true, publishedAt, createdAt })
    .returning({ id: reviews.id })
  created.push(row.id)
  return row.id
}

describe('review moderation', () => {
  it('lists pending reviews newest first, and publishing moves them out of the queue', async () => {
    if (!available) return
    // Dated in the future so they sort ahead of anything already in the table.
    const older = await addReview('Older pending review', null, new Date(Date.now() + 60_000))
    const newer = await addReview('Newer pending review', null, new Date(Date.now() + 120_000))
    const live = await addReview('Already published', new Date(), new Date(Date.now() + 180_000))

    const pending = (await get('/v1/admin/reviews')).json()
    const ids = pending.reviews.map((r: { id: string }) => r.id)
    expect(ids.slice(0, 2)).toEqual([newer, older])
    expect(ids).not.toContain(live)
    expect(pending.reviews[0]).toMatchObject({ productSlug: SLUG, authorName: 'Test Reader', rating: 4, verified: true, publishedAt: null })

    const firstPage = (await get('/v1/admin/reviews?limit=1')).json()
    expect(firstPage.reviews).toHaveLength(1)
    expect(firstPage.hasMore).toBe(true)

    expect((await patch(`/v1/admin/reviews/${newer}`, { published: true })).statusCode).toBe(200)
    expect((await get('/v1/admin/reviews')).json().reviews.map((r: { id: string }) => r.id)).not.toContain(newer)
    const published = (await get('/v1/admin/reviews?status=published')).json().reviews.map((r: { id: string }) => r.id)
    expect(published.slice(0, 2)).toEqual([live, newer])

    // Unpublishing puts it back in the queue.
    await patch(`/v1/admin/reviews/${newer}`, { published: false })
    expect((await get('/v1/admin/reviews')).json().reviews[0].id).toBe(newer)
  })

  it('is staff only', async () => {
    if (!available) return
    expect((await get('/v1/admin/reviews', customer)).statusCode).toBe(403)
    expect((await app.inject({ method: 'GET', url: '/v1/admin/reviews' })).statusCode).toBe(401)
  })
})

describe('variant prices', () => {
  it('refuses a struck-out price at or below the selling price with a reason, not a 500', async () => {
    if (!available) return
    const product = await db.query.products.findFirst({ where: eq(products.slug, SLUG), with: { variants: true } })
    const variant = product!.variants[0]
    const url = `/v1/admin/products/${SLUG}/variants/${encodeURIComponent(variant.size)}`

    const refused = await patch(url, { price: variant.price, compareAtPrice: variant.price })
    expect(refused.statusCode).toBe(400)
    expect(refused.json().detail).toMatch(/higher than the selling price/)
    const after = await db.query.productVariants.findFirst({ where: eq(productVariants.id, variant.id) })
    expect(after?.compareAtPrice).toBe(variant.compareAtPrice)
  })
})
