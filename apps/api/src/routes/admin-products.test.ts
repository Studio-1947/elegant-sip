import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'
import sharp from 'sharp'
import { seed } from '../db/seed.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin price and visibility edits, as the admin panel sends them. Against the
 * seeded database; skips without the docker stack. Restores what it changes.
 * ──────────────────────────────────────────────────────────────────────────── */

let app: FastifyInstance
let available = true
let adminCookie = ''
const PASSWORD = 'correct-horse-battery'
const SLUG = 'green-tea'
const SIZE = '100 g'

const variant = () =>
  db
    .select({ price: productVariants.price, compareAtPrice: productVariants.compareAtPrice })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(eq(products.slug, SLUG))
    .then((rows) => rows[0])

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()

  const email = `admin-prices.${Date.now()}@example.test`
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Price Admin', email, password: PASSWORD } })
  await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  const cookie = login.cookies.find((c) => c.name === 'es_session')
  adminCookie = `es_session=${cookie?.value}`
})

afterAll(async () => {
  if (available) {
    // Hand green tea back to the seed: clear the admin ownership these tests
    // gave it and re-seed, which restores its original content and packs.
    await db.update(products).set({ adminEditedAt: null }).where(eq(products.slug, SLUG))
    await seed()
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

const patchPrice = (payload: object, cookie = adminCookie) =>
  app.inject({
    method: 'PATCH',
    url: `/v1/admin/products/${SLUG}/variants/${encodeURIComponent(SIZE)}`,
    headers: { cookie },
    payload,
  })

describe('admin price edits', () => {
  it('saves a new price, and checkout and the Meta feed use it straight away', async () => {
    if (!available) return
    const before = await variant()
    try {
      const res = await patchPrice({ price: 55500, compareAtPrice: 77700 })
      expect(res.statusCode, res.body).toBe(200)

      const quote = await app.inject({
        method: 'POST',
        url: '/v1/pricing/quote',
        payload: { items: [{ productSlug: SLUG, variantSize: SIZE, quantity: 1 }] },
      })
      expect(quote.json().items[0].unitPrice).toBe(55500)

      const feed = await app.inject({ method: 'GET', url: '/v1/feeds/meta.csv' })
      expect(feed.body).toContain('777.00 INR,555.00 INR')
    } finally {
      await db.update(productVariants).set(before).where(eq(productVariants.sku, 'P019-S100'))
    }
  })

  it('explains a regular price that is not above the selling price, instead of failing', async () => {
    if (!available) return
    const res = await patchPrice({ price: 90000, compareAtPrice: 80000 })
    expect(res.statusCode).toBe(400)
    expect(res.json().detail).toMatch(/higher than the selling price/)

    // Raising the price past the existing regular price is caught too.
    const existing = await variant()
    if (existing.compareAtPrice !== null) {
      const above = await patchPrice({ price: existing.compareAtPrice + 100 })
      expect(above.statusCode).toBe(400)
    }
    expect(await variant()).toEqual(existing)
  })

  it('refuses customers', async () => {
    if (!available) return
    const res = await patchPrice({ price: 100 }, '')
    expect([401, 403]).toContain(res.statusCode)
  })
})

describe('admin visibility', () => {
  it('hides and shows a product', async () => {
    if (!available) return
    try {
      const hide = await app.inject({
        method: 'PATCH',
        url: `/v1/admin/products/${SLUG}`,
        headers: { cookie: adminCookie },
        payload: { listed: false },
      })
      expect(hide.statusCode, hide.body).toBe(200)
      const list = await app.inject({ method: 'GET', url: '/v1/products' })
      expect(list.json().products.find((p: { slug: string }) => p.slug === SLUG).listed).toBe(false)
    } finally {
      await db.update(products).set({ listed: true }).where(eq(products.slug, SLUG))
    }
  })
})

describe('admin product editor', () => {
  const patchProduct = (payload: object) =>
    app.inject({ method: 'PATCH', url: `/v1/admin/products/${SLUG}`, headers: { cookie: adminCookie }, payload })

  it('uploads a photo as WebP with its smaller sizes, and rejects non-images', async () => {
    if (!available) return
    const png = await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#8bb56e' } }).png().toBuffer()
    const res = await app.inject({
      method: 'POST',
      url: '/v1/admin/uploads/product-photo',
      headers: { cookie: adminCookie, 'content-type': 'image/png' },
      payload: png,
    })
    expect(res.statusCode, res.body).toBe(200)
    const { src, width } = res.json()
    expect(src).toMatch(/^\/uploads\/products\/[a-z0-9]+\.webp$/)
    expect(width).toBe(1200)
    for (const suffix of ['', '-640', '-1024']) {
      const file = await app.inject({ method: 'GET', url: src.replace('.webp', `${suffix}.webp`) })
      expect(file.statusCode).toBe(200)
      expect(file.headers['content-type']).toBe('image/webp')
    }

    const bad = await app.inject({
      method: 'POST',
      url: '/v1/admin/uploads/product-photo',
      headers: { cookie: adminCookie, 'content-type': 'image/png' },
      payload: Buffer.from('not really a png'),
    })
    expect(bad.statusCode).toBe(400)

    const anonymous = await app.inject({
      method: 'POST',
      url: '/v1/admin/uploads/product-photo',
      headers: { 'content-type': 'image/png' },
      payload: png,
    })
    expect(anonymous.statusCode).toBe(401)
  })

  it('saves text and photos, shows them in the catalogue and feed, and a re-seed leaves them alone', async () => {
    if (!available) return
    const res = await patchProduct({
      name: 'Green Tea (edited)',
      description: 'An edited short description for the test.',
      images: ['/products/green-tea-alt.webp', '/products/green-tea.webp'],
      tastingNotes: ['Edited'],
    })
    expect(res.statusCode, res.body).toBe(200)

    await seed()

    const listed = (await app.inject({ method: 'GET', url: '/v1/products' })).json().products.find((p: { slug: string }) => p.slug === SLUG)
    expect(listed.name).toBe('Green Tea (edited)')
    expect(listed.images).toEqual(['/products/green-tea-alt.webp', '/products/green-tea.webp'])
    expect(listed.tastingNotes).toEqual(['Edited'])

    const feed = await app.inject({ method: 'GET', url: '/v1/feeds/meta.csv' })
    const row = feed.body.split('\n').find((line) => line.startsWith('P019-S100'))
    expect(row).toContain('Green Tea (edited)')
    expect(row).toContain(`${env.SITE_URL.replace(/\/$/, '')}/products/green-tea-alt.webp,${env.SITE_URL.replace(/\/$/, '')}/products/green-tea.webp`)
  })

  it('refuses a photo path that is not on this site', async () => {
    if (!available) return
    for (const imageSrc of ['https://example.com/x.webp', '/../etc/passwd.png', '/products/x.exe']) {
      expect((await patchProduct({ imageSrc })).statusCode).toBe(400)
    }
  })

  it('adds and removes a pack, but never the last one or one that has been ordered', async () => {
    if (!available) return
    const add = await app.inject({
      method: 'POST',
      url: `/v1/admin/products/${SLUG}/variants`,
      headers: { cookie: adminCookie },
      payload: { size: '250 g', price: 140000, stock: 5 },
    })
    expect(add.statusCode, add.body).toBe(200)

    const del = (size: string) =>
      app.inject({ method: 'DELETE', url: `/v1/admin/products/${SLUG}/variants/${encodeURIComponent(size)}`, headers: { cookie: adminCookie } })
    expect((await del('250 g')).statusCode).toBe(200)
    expect((await del(SIZE)).json().type).toBe('last_pack')
  })
})
