import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq, inArray } from 'drizzle-orm'
import type { EmailMessage } from '../lib/email.js'

const INTERAKT_URL = vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  const base = 'https://interakt.test/v1/public'
  process.env.AUTH_OTP_PROVIDER = 'interakt'
  process.env.INTERAKT_API_KEY = 'test-interakt-key'
  process.env.INTERAKT_API_BASE_URL = base
  return base
})
const sendEmail = vi.hoisted(() => vi.fn(async (_message: EmailMessage) => ({ delivered: true })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { orders, users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'

/*
 * Account follow-ups: WhatsApp-only accounts adding an email and password,
 * honest `delivered` flags, and guest orders joining the account once its
 * address is confirmed.
 */

let app: FastifyInstance
let available = true

let sent: { phoneNumber: string; code: string }[] = []
const realFetch = globalThis.fetch
const fetchStub = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith(INTERAKT_URL)) {
    const body = JSON.parse(String(init?.body)) as { phoneNumber: string; template: { bodyValues: string[] } }
    sent.push({ phoneNumber: body.phoneNumber, code: body.template.bodyValues[0] })
    return new Response(JSON.stringify({ result: true }), { status: 201, headers: { 'content-type': 'application/json' } })
  }
  return realFetch(input, init)
})

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  vi.stubGlobal('fetch', fetchStub)
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  vi.unstubAllGlobals()
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

beforeEach(() => {
  sent = []
  sendEmail.mockClear()
  sendEmail.mockImplementation(async () => ({ delivered: true }))
})

const PASSWORD = 'correct-horse-battery'
const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
const freshPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
const cookieFrom = (res: { cookies: { name: string; value: string }[] }) => `es_session=${res.cookies.find((c) => c.name === 'es_session')!.value}`
const post = (url: string, payload?: object, cookie?: string) =>
  app.inject({ method: 'POST', url, ...(payload ? { payload } : {}), ...(cookie ? { headers: { cookie } } : {}) })
const lastCode = (phone: string) => sent.findLast((s) => s.phoneNumber === phone)!.code
/** The token from the newest confirmation email to `to`. */
const confirmationToken = (to: string) => {
  const message = sendEmail.mock.calls.map(([m]) => m).findLast((m) => m.to === to && m.subject === 'Confirm your Elegant Sip account')
  return new URL(message!.action!.url).searchParams.get('token')!
}

async function whatsappAccount() {
  const phone = freshPhone()
  const request = await post('/v1/auth/whatsapp/request', { phone })
  const verified = await post('/v1/auth/whatsapp/verify', { challengeId: request.json().challengeId, code: lastCode(phone) })
  expect(verified.statusCode).toBe(200)
  return { phone, cookie: cookieFrom(verified), user: verified.json().user as { id: string; email: string } }
}

async function emailAccount(email = unique('acct')) {
  await post('/v1/auth/register', { name: 'Account Tester', email, password: PASSWORD })
  const login = await post('/v1/auth/login', { email, password: PASSWORD })
  return { email, cookie: cookieFrom(login), id: login.json().user.id as string }
}

describe('WhatsApp-only accounts adding an email and password', () => {
  it('sets them after a fresh code to the account’s own number, and sends a confirmation link', async () => {
    if (!available) return
    const { phone, cookie, user } = await whatsappAccount()
    expect(user.email).toMatch(/\.invalid$/)

    const request = await post('/v1/account/credentials/request', undefined, cookie)
    expect(request.statusCode).toBe(200)
    const { challengeId } = request.json()
    const email = unique('wa-adds')

    const wrong = await post('/v1/account/credentials', { challengeId, code: '000000', email, password: PASSWORD }, cookie)
    expect(wrong.statusCode).toBe(400)

    const done = await post('/v1/account/credentials', { challengeId, code: lastCode(phone), email, password: PASSWORD }, cookie)
    expect(done.statusCode).toBe(200)
    expect(done.json()).toMatchObject({ delivered: true, user: { email, emailIsPlaceholder: false, emailVerified: false } })
    expect(confirmationToken(email)).toBeTruthy()

    // The new credentials work, and the route is closed now the stand-in is gone.
    expect((await post('/v1/auth/login', { email, password: PASSWORD })).json().user.id).toBe(user.id)
    const again = await post('/v1/account/credentials/request', undefined, cookie)
    expect(again.statusCode).toBe(409)
    expect(again.json().type).toBe('credentials_exist')
  })

  it('reports an undelivered confirmation honestly', async () => {
    if (!available) return
    const { phone, cookie } = await whatsappAccount()
    sendEmail.mockImplementation(async () => ({ delivered: false }))
    const { challengeId } = (await post('/v1/account/credentials/request', undefined, cookie)).json()
    const done = await post('/v1/account/credentials', { challengeId, code: lastCode(phone), email: unique('wa-undelivered'), password: PASSWORD }, cookie)
    expect(done.statusCode).toBe(200)
    expect(done.json().delivered).toBe(false)
  })

  it('will not accept a code sent to some other number', async () => {
    if (!available) return
    const { cookie } = await whatsappAccount()
    const other = freshPhone()
    const link = await post('/v1/account/whatsapp/request', { phone: other }, cookie)
    const res = await post('/v1/account/credentials', { challengeId: link.json().challengeId, code: lastCode(other), email: unique('wa-other'), password: PASSWORD }, cookie)
    expect(res.statusCode).toBe(400)
  })

  it('refuses an address already in use, and accounts that already have one', async () => {
    if (!available) return
    const existing = await emailAccount()
    expect((await post('/v1/account/credentials/request', undefined, existing.cookie)).statusCode).toBe(409)
    expect((await post('/v1/account/credentials/request')).statusCode).toBe(401)

    const { phone, cookie } = await whatsappAccount()
    const { challengeId } = (await post('/v1/account/credentials/request', undefined, cookie)).json()
    const taken = await post('/v1/account/credentials', { challengeId, code: lastCode(phone), email: existing.email, password: PASSWORD }, cookie)
    expect(taken.statusCode).toBe(409)
    expect(taken.json().type).toBe('email_taken')
  })
})

describe('WhatsApp sign-in and two-step sign-in', () => {
  it('refuses WhatsApp sign-in for an account with two-step sign-in on', async () => {
    if (!available) return
    const { phone, user } = await whatsappAccount()
    await db.update(users).set({ mfaEnabledAt: new Date() }).where(eq(users.id, user.id))
    const request = await post('/v1/auth/whatsapp/request', { phone })
    const res = await post('/v1/auth/whatsapp/verify', { challengeId: request.json().challengeId, code: lastCode(phone) })
    expect(res.statusCode).toBe(403)
    expect(res.json().type).toBe('mfa_required')
    expect(res.cookies.find((c) => c.name === 'es_session')).toBeUndefined()
  })
})

describe('delivered flags', () => {
  it('say whether the password-change notice, email-change link and resent link went out', async () => {
    if (!available) return
    const { cookie } = await emailAccount()

    sendEmail.mockImplementation(async () => ({ delivered: false }))
    const changed = await post('/v1/auth/password/change', { currentPassword: PASSWORD, newPassword: 'another-long-password' }, cookie)
    expect(changed.json()).toEqual({ ok: true, delivered: false })
    const fresh = cookieFrom(changed)

    const resent = await post('/v1/auth/verify-email/resend', undefined, fresh)
    expect(resent.json()).toEqual({ ok: true, delivered: false })

    sendEmail.mockImplementation(async () => ({ delivered: true }))
    expect((await post('/v1/auth/verify-email/resend', undefined, fresh)).json()).toEqual({ ok: true, delivered: true })
    const moved = await post('/v1/auth/email/change', { newEmail: unique('moved'), currentPassword: 'another-long-password' }, fresh)
    expect(moved.statusCode).toBe(200)
    expect(moved.json().delivered).toBe(true)
  })

  it('reports nothing sent when the address is already confirmed', async () => {
    if (!available) return
    const { email, cookie } = await emailAccount()
    await post('/v1/auth/verify-email', { token: confirmationToken(email) })
    sendEmail.mockClear()
    expect((await post('/v1/auth/verify-email/resend', undefined, cookie)).json()).toEqual({ ok: true, delivered: false })
    expect(sendEmail).not.toHaveBeenCalled()
  })
})

describe('guest orders joining the account', () => {
  let n = 0
  async function guestOrder(email: string, userId: string | null = null) {
    const [row] = await db
      .insert(orders)
      .values({
        number: `ES-TEST-${Date.now()}-${++n}-${Math.round(Math.random() * 1e6)}`,
        userId,
        email,
        shippingName: 'Guest Buyer',
        shippingLine1: '12 Hill Cart Road',
        shippingCity: 'Darjiling',
        shippingPostalCode: '734101',
        shippingMethod: 'standard',
        subtotal: 50_000,
        shippingFee: 0,
        tax: 0,
        total: 50_000,
      })
      .returning({ id: orders.id })
    return row.id
  }
  const owners = async (ids: string[]) =>
    Object.fromEntries((await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(inArray(orders.id, ids))).map((r) => [r.id, r.userId]))

  it('claims guest orders with the same address once it is confirmed, and nothing else', async () => {
    if (!available) return
    const email = unique('guest')
    const other = await emailAccount()
    const mine = [await guestOrder(email), await guestOrder(email.toUpperCase())]
    const someoneElses = await guestOrder(unique('stranger'))
    const alreadyOwned = await guestOrder(email, other.id)

    const { id } = await emailAccount(email)
    // Not before the address is proven.
    expect(Object.values(await owners(mine))).toEqual([null, null])

    expect((await post('/v1/auth/verify-email', { token: confirmationToken(email) })).statusCode).toBe(200)
    const after = await owners([...mine, someoneElses, alreadyOwned])
    expect(after[mine[0]]).toBe(id)
    expect(after[mine[1]]).toBe(id)
    expect(after[someoneElses]).toBeNull()
    expect(after[alreadyOwned]).toBe(other.id)
  })

  it('after an email change, only the link sent to the new address confirms it (and claims its orders)', async () => {
    if (!available) return
    const { email, id, cookie } = await emailAccount()
    const oldToken = confirmationToken(email)
    const target = unique('changed-to')
    const order = await guestOrder(target)

    expect((await post('/v1/auth/email/change', { newEmail: target, currentPassword: PASSWORD }, cookie)).statusCode).toBe(200)
    // The link sent to the old address must not vouch for the new one.
    expect((await post('/v1/auth/verify-email', { token: oldToken })).statusCode).toBe(400)
    expect((await owners([order]))[order]).toBeNull()

    expect((await post('/v1/auth/verify-email', { token: confirmationToken(target) })).statusCode).toBe(200)
    expect((await owners([order]))[order]).toBe(id)
  })
})
