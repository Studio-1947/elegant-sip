import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { storeSettings, users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'
import { getStoreSettings } from '../lib/settings.js'

/* Shop-wide settings: staff-only, validated, stamped, and visible to the storefront. */

const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let customer = ''
let staffEmail = ''
// The suite shares the dev database, so the row is put back exactly as found.
let original: typeof storeSettings.$inferSelect | undefined

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(admin: boolean) {
  const email = unique(admin ? 'settings-staff' : 'settings-shopper')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: admin ? 'Settings Staff' : 'Shopper', email, password: PASSWORD } })
  if (admin) {
    await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
    staffEmail = email
  }
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  return `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
}

const get = (cookie: string) => app.inject({ method: 'GET', url: '/v1/admin/settings', headers: { cookie } })
const patch = (payload: object, cookie = staff) =>
  app.inject({ method: 'PATCH', url: '/v1/admin/settings', headers: { cookie }, payload })

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  ;[original] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1))
  app = await buildApp()
  await app.ready()
  staff = await signUp(true)
  customer = await signUp(false)
})

afterAll(async () => {
  if (available && original) {
    const { id: _id, ...row } = original
    await db.update(storeSettings).set(row).where(eq(storeSettings.id, 1))
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('admin settings', () => {
  it('is staff only', async () => {
    if (!available) return
    expect((await app.inject({ method: 'GET', url: '/v1/admin/settings' })).statusCode).toBe(401)
    expect((await get(customer)).statusCode).toBe(403)
    expect((await patch({ guaranteeEnabled: false }, customer)).statusCode).toBe(403)
  })

  it('reads the row and saves a partial change, stamping who made it', async () => {
    if (!available) return
    const read = await get(staff)
    expect(read.statusCode).toBe(200)
    expect(read.json()).toMatchObject({
      guestCheckoutEnabled: expect.any(Boolean),
      guaranteeEnabled: expect.any(Boolean),
      guaranteeDays: expect.any(Number),
      lowStockThreshold: expect.any(Number),
    })

    const before = Date.now()
    const saved = await patch({ guaranteeEnabled: false, guaranteeDays: 14, lowStockThreshold: 3 })
    expect(saved.statusCode).toBe(200)
    const body = saved.json()
    expect(body).toMatchObject({ guaranteeEnabled: false, guaranteeDays: 14, lowStockThreshold: 3, updatedBy: { name: 'Settings Staff', email: staffEmail } })
    // Untouched fields keep their value.
    expect(body.guestCheckoutEnabled).toBe(read.json().guestCheckoutEnabled)
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThanOrEqual(before - 1_000)
    expect((await get(staff)).json()).toEqual(body)
  })

  it('refuses values outside the allowed ranges and empty changes', async () => {
    if (!available) return
    for (const payload of [{ guaranteeDays: 0 }, { guaranteeDays: 366 }, { lowStockThreshold: -1 }, { lowStockThreshold: 1001 }, { guaranteeDays: 2.5 }, {}, { unknown: true }]) {
      expect((await patch(payload)).statusCode, JSON.stringify(payload)).toBe(400)
    }
  })

  it('takes effect at once for the cached reader and the storefront status', async () => {
    if (!available) return
    await patch({ guaranteeEnabled: true, guaranteeDays: 45, guestCheckoutEnabled: true })
    expect(await getStoreSettings()).toMatchObject({ guaranteeEnabled: true, guaranteeDays: 45, guestCheckoutEnabled: true })
    const status = (await app.inject({ method: 'GET', url: '/storefront-status' })).json()
    expect(status).toEqual({ paymentsAvailable: expect.any(Boolean), guestCheckout: true, guarantee: { enabled: true, days: 45 } })

    await patch({ guaranteeEnabled: false, guestCheckoutEnabled: false })
    const off = (await app.inject({ method: 'GET', url: '/storefront-status' })).json()
    expect(off).toMatchObject({ guestCheckout: false, guarantee: { enabled: false, days: 45 } })
  })

  it('uses the configured threshold for the low-stock list unless one is asked for', async () => {
    if (!available) return
    await patch({ lowStockThreshold: 0 })
    const atZero = (await app.inject({ method: 'GET', url: '/v1/admin/stock/low', headers: { cookie: staff } })).json()
    expect(atZero.variants.every((v: { stock: number }) => v.stock <= 0)).toBe(true)
    await patch({ lowStockThreshold: 1000 })
    const high = (await app.inject({ method: 'GET', url: '/v1/admin/stock/low', headers: { cookie: staff } })).json()
    expect(high.variants.length).toBeGreaterThan(atZero.variants.length)
    const asked = (await app.inject({ method: 'GET', url: '/v1/admin/stock/low?threshold=0', headers: { cookie: staff } })).json()
    expect(asked.variants.every((v: { stock: number }) => v.stock <= 0)).toBe(true)
  })

})
