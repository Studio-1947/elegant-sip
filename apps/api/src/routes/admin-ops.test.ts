import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray, like } from 'drizzle-orm'
import type { EmailMessage } from '../lib/email.js'

const sendEmail = vi.hoisted(() => vi.fn(async (_message: EmailMessage) => ({ delivered: false })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

const { buildApp } = await import('../app.js')
const { db, sql } = await import('../db/client.js')
const { productVariants, products } = await import('../db/schema.js')
const { contactMessages, emailOutbox, users } = await import('../db/schema-commerce.js')
const { redis } = await import('../lib/sessions.js')
const { getStoreSettings } = await import('../lib/settings.js')

/* Contact references, the email outbox and audit log endpoints, and the
   low-stock mark set and cleared through the admin stock endpoint. */

const TAG = `ops-${Date.now()}`
const PASSWORD = 'correct-horse-battery'

let app: FastifyInstance
let available = true
let staff = ''
let staffId = ''
let customer = ''
let productId = ''

async function signUp(admin: boolean) {
  const email = `${TAG}.${admin ? 'staff' : 'shopper'}@example.test`
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: admin ? 'Audit Person' : 'Test Shopper', email, password: PASSWORD } })
  if (admin) await db.update(users).set({ role: 'admin' }).where(eq(users.email, email))
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  return { cookie: `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`, id: user!.id }
}

const get = (url: string, cookie = staff) => app.inject({ method: 'GET', url, headers: { cookie } })
const post = (url: string, payload: object, cookie = staff) => app.inject({ method: 'POST', url, headers: { cookie }, payload })

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
  ;({ cookie: staff, id: staffId } = await signUp(true))
  ;({ cookie: customer } = await signUp(false))
  const [product] = await db
    .insert(products)
    .values({ slug: TAG, name: 'Ops Test Tea', description: 'x', imageSrc: '/x.webp', category: 'test' })
    .returning({ id: products.id })
  productId = product.id
  await db.insert(productVariants).values({ productId, size: '50g', sku: `${TAG}-50g`, price: 10_000, stock: 100 })
})

afterAll(async () => {
  if (available) {
    if (productId) await db.delete(products).where(eq(products.id, productId))
    await db.delete(contactMessages).where(like(contactMessages.email, `${TAG}%`))
    await db.delete(emailOutbox).where(like(emailOutbox.to, `${TAG}%`))
  }
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

describe('contact form', () => {
  it('stores the message under a reference, puts it in the subject, and is honest about delivery', async () => {
    if (!available) return
    sendEmail.mockClear()
    const email = `${TAG}.writer@example.test`
    const res = await post('/v1/contact', { name: 'Asha Rai', email, subject: 'Order question', message: 'Where is my parcel, please?' }, '')
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.reference).toMatch(/^ES-C-[2346789ABCDEFGHJKMNPQRTUVWXYZ]{6}$/)
    expect(body).toMatchObject({ delivered: false, retrying: false })

    const [stored] = await db.select().from(contactMessages).where(eq(contactMessages.reference, body.reference))
    expect(stored).toMatchObject({ name: 'Asha Rai', email, subject: 'Order question', message: 'Where is my parcel, please?', userId: null })

    const sent = sendEmail.mock.calls.at(-1)![0]
    expect(sent.subject).toContain(body.reference)
    expect(sent).toMatchObject({ kind: 'contact', replyTo: email })
  })

  it('reports delivered only when the email went out, and links a signed-in sender', async () => {
    if (!available) return
    sendEmail.mockResolvedValueOnce({ delivered: true })
    const res = await post('/v1/contact', { name: 'Test Shopper', email: `${TAG}.member@example.test`, subject: 'Wholesale', message: 'Do you sell by the kilo?' }, customer)
    expect(res.json()).toMatchObject({ delivered: true, retrying: false })
    const [stored] = await db.select().from(contactMessages).where(eq(contactMessages.reference, res.json().reference))
    expect(stored.userId).not.toBeNull()
  })
})

describe('email outbox', () => {
  it('lists pending and failed messages without bodies, staff only', async () => {
    if (!available) return
    const [pending] = await db
      .insert(emailOutbox)
      .values({ kind: 'general', to: `${TAG}.a@example.test`, subject: 'Pending one', html: '<p>private</p>', text: 'private', attempts: 2, lastError: 'timeout' })
      .returning()
    await db.insert(emailOutbox).values({ kind: 'general', to: `${TAG}.b@example.test`, subject: 'Sent one', html: '', text: '', status: 'sent', sentAt: new Date() })

    expect((await get('/v1/admin/email-outbox', customer)).statusCode).toBe(403)
    const res = await get('/v1/admin/email-outbox')
    expect(res.statusCode).toBe(200)
    const mine = res.json().messages.filter((m: { to: string }) => m.to.startsWith(TAG))
    expect(mine).toEqual([expect.objectContaining({ id: pending.id, subject: 'Pending one', status: 'pending', attempts: 2, lastError: 'timeout' })])
    expect(res.body).not.toContain('private')
  })

  it('"Retry now" reports a refusal honestly and 404s an unknown id', async () => {
    if (!available) return
    const [row] = await db
      .insert(emailOutbox)
      .values({ kind: 'general', to: `${TAG}.c@example.test`, subject: 'Retry me', html: '<p>x</p>', text: 'x', attempts: 1 })
      .returning()
    // No SMTP in tests, so the attempt fails: the message must not come back as sent.
    const res = await post(`/v1/admin/email-outbox/${row.id}/retry`, {})
    expect(res.statusCode).toBe(200)
    expect(res.json().message).toMatchObject({ id: row.id, status: 'pending', attempts: 2, lastError: 'SMTP_URL is not configured' })
    expect((await post('/v1/admin/email-outbox/00000000-0000-4000-8000-000000000000/retry', {})).statusCode).toBe(404)
  })
})

describe('audit log', () => {
  it('lists staff changes newest first with who made them, filterable by person', async () => {
    if (!available) return
    // The retry above was a staff POST, so this person already has an entry.
    expect((await get('/v1/admin/audit', customer)).statusCode).toBe(403)
    const res = await get(`/v1/admin/audit?actor=${staffId}&limit=1`)
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.events).toHaveLength(1)
    expect(body.events[0]).toMatchObject({ action: 'POST /v1/admin/email-outbox/:id/retry', statusCode: 200, actor: { id: staffId, name: 'Audit Person', email: `${TAG}.staff@example.test` } })
    expect(body.actors).toContainEqual({ id: staffId, name: 'Audit Person', email: `${TAG}.staff@example.test` })

    const all = (await get('/v1/admin/audit?limit=5')).json()
    const times = all.events.map((e: { occurredAt: string }) => Date.parse(e.occurredAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
  })
})

describe('low-stock alert mark', () => {
  it('is set when an admin adjustment takes a pack to the threshold and cleared by a restock', async () => {
    if (!available) return
    const { lowStockThreshold } = await getStoreSettings()
    const alertedAt = async () =>
      (await db.select({ at: productVariants.lowStockAlertedAt }).from(productVariants).where(inArray(productVariants.sku, [`${TAG}-50g`])))[0].at
    sendEmail.mockClear()

    const down = await post('/v1/admin/stock', { productSlug: TAG, variantSize: '50g', delta: lowStockThreshold - 100 })
    expect(down.statusCode).toBe(200)
    expect(await alertedAt()).not.toBeNull()
    expect(sendEmail.mock.calls.filter(([m]) => m.subject.includes('running low'))).toHaveLength(1)

    await post('/v1/admin/stock', { productSlug: TAG, variantSize: '50g', delta: 10 })
    expect(await alertedAt()).toBeNull()
  })
})
