import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { gardens, products } from '../db/schema.js'
import { users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'

/* The garden editor's API, and what the public garden list shows. */

const PASSWORD = 'correct-horse-battery'
const stamp = Date.now()
const GARDEN = `test-garden-${stamp}`
const LIVE = `test-garden-live-${stamp}`
const RETIRED = `test-garden-retired-${stamp}`

let app: FastifyInstance
let available = true
let staff = ''
let customer = ''

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(admin: boolean) {
  const email = unique(admin ? 'staff' : 'shopper')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Test Person', email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  return `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
}

const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object, cookie = staff) =>
  app.inject({ method, url, headers: { cookie }, payload })

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
  const base = { status: 'active' as const, description: 'Test tea', imageSrc: '/origin.webp', category: 'Test' }
  await db.insert(products).values([
    { ...base, slug: LIVE, name: 'Garden Test Live' },
    { ...base, slug: RETIRED, name: 'Garden Test Retired', archivedAt: new Date() },
  ])
})

afterAll(async () => {
  if (available) {
    await db.delete(gardens).where(eq(gardens.slug, GARDEN))
    await db.delete(products).where(inArray(products.slug, [LIVE, RETIRED]))
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('garden editor', () => {
  it('is staff only', async () => {
    if (!available) return
    expect((await call('GET', '/v1/admin/gardens', undefined, customer)).statusCode).toBe(403)
  })

  it('creates a garden, refusing a bad image path or an unknown product', async () => {
    if (!available) return
    const body = {
      slug: GARDEN,
      name: 'Test Estate',
      region: 'Test Valley · Darjeeling',
      elevation: '2,000 ft',
      imageSrc: '/origin.webp',
      story: ['First paragraph.', 'Second paragraph.'],
      productSlugs: [LIVE],
    }
    expect((await call('POST', '/v1/admin/gardens', { ...body, imageSrc: 'https://example.com/x.webp' })).statusCode).toBe(400)
    expect((await call('POST', '/v1/admin/gardens', { ...body, imageSrc: '/../secret.webp' })).statusCode).toBe(400)
    expect((await call('POST', '/v1/admin/gardens', { ...body, productSlugs: ['no-such-tea'] })).statusCode).toBe(400)
    expect(await db.query.gardens.findFirst({ where: eq(gardens.slug, GARDEN) })).toBeUndefined()

    const created = await call('POST', '/v1/admin/gardens', body)
    expect(created.statusCode).toBe(201)
    expect(created.json()).toMatchObject({ slug: GARDEN, story: body.story, products: [{ slug: LIVE, archived: false }] })
    expect((await call('POST', '/v1/admin/gardens', body)).statusCode).toBe(409)
  })

  it('edits copy and replaces the product links', async () => {
    if (!available) return
    const edited = await call('PATCH', `/v1/admin/gardens/${GARDEN}`, {
      name: 'Test Estate Renamed',
      story: ['Only paragraph.'],
      productSlugs: [LIVE, RETIRED],
    })
    expect(edited.statusCode).toBe(200)
    expect(edited.json()).toMatchObject({ name: 'Test Estate Renamed', region: 'Test Valley · Darjeeling', story: ['Only paragraph.'] })
    expect(edited.json().products.map((p: { slug: string }) => p.slug).sort()).toEqual([LIVE, RETIRED].sort())

    const listed = (await call('GET', '/v1/admin/gardens')).json()
    const mine = listed.gardens.find((g: { slug: string }) => g.slug === GARDEN)
    expect(mine.products.find((p: { slug: string }) => p.slug === RETIRED).archived).toBe(true)
  })

  it('leaves retired teas out of the public list', async () => {
    if (!available) return
    const garden = (await app.inject({ method: 'GET', url: `/v1/gardens/${GARDEN}` })).json()
    expect(garden.productSlugs).toEqual([LIVE])
    const all = (await app.inject({ method: 'GET', url: '/v1/gardens' })).json()
    expect(all.gardens.find((g: { slug: string }) => g.slug === GARDEN).productSlugs).toEqual([LIVE])
  })

  it('deletes a garden without touching its products', async () => {
    if (!available) return
    expect((await call('DELETE', `/v1/admin/gardens/${GARDEN}`)).statusCode).toBe(200)
    expect((await app.inject({ method: 'GET', url: `/v1/gardens/${GARDEN}` })).statusCode).toBe(404)
    expect(await db.query.products.findFirst({ where: eq(products.slug, LIVE) })).toBeTruthy()
    expect((await call('DELETE', `/v1/admin/gardens/${GARDEN}`)).statusCode).toBe(404)
  })
})
