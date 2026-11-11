import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { eq } from 'drizzle-orm'
import { db, sql } from '../db/client.js'
import { products } from '../db/schema.js'
import { env } from '../env.js'
import { redis } from '../lib/sessions.js'
import { META_FEED_COLUMNS, csvField } from '../lib/meta-feed.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Meta feed, against the seeded database. Skips without the docker stack.
 * ──────────────────────────────────────────────────────────────────────────── */

let app: FastifyInstance
let available = true

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

/** Minimal RFC 4180 parser: enough to read back what the feed writes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += c
  }
  if (field || row.length) rows.push([...row, field])
  return rows
}

const fetchFeed = async () => {
  const res = await app.inject({ method: 'GET', url: '/v1/feeds/meta.csv' })
  const [header, ...body] = parseCsv(res.body)
  const records = body.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]])))
  return { res, header, records }
}

const paise = (feedPrice: string) => {
  const m = /^(\d+)\.(\d{2}) INR$/.exec(feedPrice)
  if (!m) throw new Error(`Bad price "${feedPrice}"`)
  return Number(m[1]) * 100 + Number(m[2])
}

describe('csvField', () => {
  it('quotes commas, quotes and line breaks, and leaves plain text alone', () => {
    expect(csvField('Green Tea')).toBe('Green Tea')
    expect(csvField('a, b')).toBe('"a, b"')
    expect(csvField('say "hi"')).toBe('"say ""hi"""')
    expect(csvField('line\nbreak')).toBe('"line\nbreak"')
  })
})

describe('GET /v1/feeds/meta.csv', () => {
  it('serves CSV with short caching and the exact column set', async () => {
    if (!available) return
    const { res, header, records } = await fetchFeed()
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
    expect(res.headers['cache-control']).toBe('public, max-age=300')
    expect(header).toEqual([...META_FEED_COLUMNS])
    expect(records.length).toBeGreaterThan(0)

    for (const r of records) {
      expect(Object.keys(r)).toHaveLength(META_FEED_COLUMNS.length)
      expect(r.condition).toBe('new')
      expect(r.brand).toBe('Elegant Sip')
      expect(r.google_product_category).toBe('Food, Beverages & Tobacco > Beverages > Tea & Infusions')
      expect(['in stock', 'out of stock']).toContain(r.availability)
      expect(r.price).toMatch(/^\d+\.\d{2} INR$/)
      if (r.sale_price) expect(paise(r.sale_price)).toBeLessThan(paise(r.price))
      expect(r.link).toMatch(new RegExp(`^${env.SITE_URL.replace(/\/$/, '')}/product/[a-z0-9-]+$`))
      expect(r.image_link.startsWith(env.SITE_URL.replace(/\/$/, ''))).toBe(true)
      expect(r.description).not.toMatch(/\n/)
    }
  })

  it('leaves out products with no price yet', async () => {
    if (!available) return
    const { records } = await fetchFeed()
    const ids = records.map((r) => r.id)
    for (const comingSoon of ['WL2F-S100', 'WLAF-S100', 'CHAM-S100']) expect(ids).not.toContain(comingSoon)
    for (const r of records) expect(paise(r.price)).toBeGreaterThan(0)
  })

  it('leaves out unlisted products', async () => {
    if (!available) return
    const { records: before } = await fetchFeed()
    const slugs = before.map((r) => r.link.split('/product/')[1])
    for (const hidden of ['first-flush-whole-leaf', 'first-flush-broken-leaf', 'first-flush-broken-mixed', 'first-flush-fannings']) {
      expect(slugs).not.toContain(hidden)
    }

    // Unlisting a product in the admin takes it out of the very next fetch.
    const target = 'green-tea'
    expect(slugs).toContain(target)
    try {
      await db.update(products).set({ listed: false }).where(eq(products.slug, target))
      const { records: after } = await fetchFeed()
      expect(after.map((r) => r.link.split('/product/')[1])).not.toContain(target)
      expect(after).toHaveLength(before.length - 1)
    } finally {
      await db.update(products).set({ listed: true }).where(eq(products.slug, target))
    }
  })

  it('charges at checkout exactly what the feed advertises', async () => {
    if (!available) return
    const { records } = await fetchFeed()
    for (const r of records.filter((x) => x.availability === 'in stock')) {
      const slug = r.link.split('/product/')[1]
      const quote = await app.inject({
        method: 'POST',
        url: '/v1/pricing/quote',
        payload: { items: [{ productSlug: slug, variantSize: r.size, quantity: 1 }], shippingMethod: 'standard' },
      })
      expect(quote.statusCode, `${slug}: ${quote.body}`).toBe(200)
      const advertised = paise(r.sale_price || r.price)
      expect(quote.json().items[0].unitPrice, slug).toBe(advertised)
    }
  })
})
