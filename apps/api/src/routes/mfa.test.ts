import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import type { EmailMessage } from '../lib/email.js'

vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  process.env.MFA_ENCRYPTION_KEY = 'a'.repeat(64)
})
const sendEmail = vi.hoisted(() => vi.fn(async (_message: EmailMessage) => ({ delivered: true })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { redis } from '../lib/sessions.js'
import { base32Decode, totp } from '../lib/totp.js'

/* Staff two-step sign-in: enrolment, the second step at sign-in, recovery codes, limits. */

let app: FastifyInstance
let available = true

const PASSWORD = 'correct-horse-battery'
const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
const cookieFrom = (res: { cookies: { name: string; value: string }[] }) => {
  const cookie = res.cookies.find((c) => c.name === 'es_session')
  return cookie ? `es_session=${cookie.value}` : null
}
const login = (email: string, password = PASSWORD) =>
  app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
const secondStep = (challengeToken: string, code: string) =>
  app.inject({ method: 'POST', url: '/v1/auth/login/mfa', payload: { challengeToken, code } })
const post = (url: string, cookie: string, payload?: object) =>
  app.inject({ method: 'POST', url, headers: { cookie }, ...(payload ? { payload } : {}) })

async function account(role: 'admin' | 'customer' = 'admin') {
  const email = unique('mfa')
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Staff Tester', email, password: PASSWORD } })
  await db.update(users).set({ role }).where(eq(users.email, email))
  return { email, cookie: cookieFrom(await login(email))! }
}

/** Enrols an admin; the codes used are for the current step, so later ones use the next. */
async function enrolled() {
  const { email, cookie } = await account()
  const setup = await post('/v1/auth/mfa/setup', cookie, { currentPassword: PASSWORD })
  const key = base32Decode(setup.json().secret)
  const confirm = await post('/v1/auth/mfa/confirm', cookie, { code: totp(key) })
  return { email, key, recoveryCodes: confirm.json().recoveryCodes as string[], cookie: cookieFrom(confirm)! }
}

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

describe('enrolment', () => {
  it('is for staff, needs the password, and refuses without an encryption key', async () => {
    if (!available) return
    const customer = await account('customer')
    expect((await post('/v1/auth/mfa/setup', customer.cookie, { currentPassword: PASSWORD })).statusCode).toBe(403)

    const staff = await account()
    expect((await post('/v1/auth/mfa/setup', staff.cookie, { currentPassword: 'not-my-password' })).statusCode).toBe(401)

    const saved = env.MFA_ENCRYPTION_KEY
    env.MFA_ENCRYPTION_KEY = undefined
    try {
      const res = await post('/v1/auth/mfa/setup', staff.cookie, { currentPassword: PASSWORD })
      expect(res.statusCode).toBe(503)
      expect(res.json().type).toBe('mfa_unavailable')
      const status = await app.inject({ method: 'GET', url: '/v1/auth/mfa', headers: { cookie: staff.cookie } })
      expect(status.json()).toEqual({ available: false, enabled: false, recoveryCodesLeft: 0 })
    } finally {
      env.MFA_ENCRYPTION_KEY = saved
    }
  })

  it('stores the secret encrypted, turns on only with a right code, and returns recovery codes once', async () => {
    if (!available) return
    const { email, cookie } = await account()
    const setup = await post('/v1/auth/mfa/setup', cookie, { currentPassword: PASSWORD })
    expect(setup.statusCode).toBe(200)
    const { secret, otpauthUri } = setup.json()
    expect(otpauthUri).toContain(`secret=${secret}`)
    const row = (await db.query.users.findFirst({ where: eq(users.email, email) }))!
    expect(row.mfaSecret).toMatch(/^v1\./)
    expect(row.mfaSecret).not.toContain(secret)

    // A pending secret changes nothing at sign-in.
    expect((await login(email)).json().user).toBeTruthy()

    const key = base32Decode(secret)
    const wrong = String((Number(totp(key)) + 1) % 1_000_000).padStart(6, '0')
    expect((await post('/v1/auth/mfa/confirm', cookie, { code: wrong })).statusCode).toBe(400)

    const confirm = await post('/v1/auth/mfa/confirm', cookie, { code: totp(key) })
    expect(confirm.statusCode).toBe(200)
    const codes = confirm.json().recoveryCodes as string[]
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)

    const after = (await db.query.users.findFirst({ where: eq(users.email, email) }))!
    expect(after.mfaEnabledAt).not.toBeNull()
    expect(after.mfaRecoveryCodes).toHaveLength(10)
    for (const digest of after.mfaRecoveryCodes) expect(digest).toMatch(/^[0-9a-f]{64}$/)
    expect(after.mfaRecoveryCodes).not.toContain(codes[0])

    // Other sessions were signed out; the confirming device got a fresh one.
    expect((await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { cookie } })).json().user).toBeNull()
    const fresh = cookieFrom(confirm)!
    const status = await app.inject({ method: 'GET', url: '/v1/auth/mfa', headers: { cookie: fresh } })
    expect(status.json()).toEqual({ available: true, enabled: true, recoveryCodesLeft: 10 })
    expect(sendEmail.mock.calls.some(([m]) => m.to === email && m.heading === 'Two-step sign-in turned on')).toBe(true)
  })
})

describe('signing in with two-step sign-in on', () => {
  it('asks for a code instead of handing out a session, and accepts the next authenticator code', async () => {
    if (!available) return
    const { email, key } = await enrolled()
    const first = await login(email)
    expect(first.statusCode).toBe(200)
    expect(first.json()).toMatchObject({ mfaRequired: true })
    expect(first.json().user).toBeUndefined()
    expect(cookieFrom(first)).toBeNull()

    const done = await secondStep(first.json().challengeToken, totp(key, Date.now() + 30_000))
    expect(done.statusCode).toBe(200)
    expect(done.json().user.email).toBe(email)
    const cookie = cookieFrom(done)!
    expect((await app.inject({ method: 'GET', url: '/v1/auth/me', headers: { cookie } })).json().user.email).toBe(email)

    // The challenge is single use, and so is the code.
    expect((await secondStep(first.json().challengeToken, totp(key, Date.now() + 30_000))).statusCode).toBe(400)
    const again = await login(email)
    const replay = await secondStep(again.json().challengeToken, totp(key, Date.now() + 30_000))
    expect(replay.statusCode).toBe(400)
  })

  it('accepts each recovery code once', async () => {
    if (!available) return
    const { email, recoveryCodes } = await enrolled()
    const first = await login(email)
    // Typed in capitals with spaces, as someone reading it off paper might.
    const done = await secondStep(first.json().challengeToken, recoveryCodes[3].toUpperCase().replace('-', ' '))
    expect(done.statusCode).toBe(200)

    const second = await login(email)
    expect((await secondStep(second.json().challengeToken, recoveryCodes[3])).statusCode).toBe(400)
    const row = (await db.query.users.findFirst({ where: eq(users.email, email) }))!
    expect(row.mfaRecoveryCodes).toHaveLength(9)
  })

  it('ends a challenge after five wrong codes', async () => {
    if (!available) return
    const { email, key } = await enrolled()
    const { challengeToken } = (await login(email)).json()
    for (let i = 0; i < 5; i++) {
      const res = await secondStep(challengeToken, '000000')
      expect(res.statusCode).toBe(400)
      expect(res.json().type).toBe('bad_request')
    }
    const late = await secondStep(challengeToken, totp(key, Date.now() + 30_000))
    expect(late.statusCode).toBe(400)
    expect(late.json().type).toBe('mfa_challenge_expired')
  })

  it('locks the account for a while after ten wrong codes, across challenges', async () => {
    if (!available) return
    const { email, recoveryCodes } = await enrolled()
    for (let i = 0; i < 10; i++) {
      const { challengeToken } = (await login(email)).json()
      expect((await secondStep(challengeToken, 'zzzzz-zzzzz')).statusCode).toBe(400)
    }
    const { challengeToken } = (await login(email)).json()
    const locked = await secondStep(challengeToken, recoveryCodes[0])
    expect(locked.statusCode).toBe(429)
    expect(locked.json().type).toBe('mfa_rate_limited')
    // The refused attempt did not spend the recovery code.
    expect((await db.query.users.findFirst({ where: eq(users.email, email) }))!.mfaRecoveryCodes).toHaveLength(10)
  })

  it('rejects a made-up challenge token', async () => {
    if (!available) return
    const res = await secondStep('x'.repeat(43), '123456')
    expect(res.statusCode).toBe(400)
    expect(res.json().type).toBe('mfa_challenge_expired')
  })
})

describe('turning it off', () => {
  it('needs the password and a code, then sign-in is password-only again', async () => {
    if (!available) return
    const { email, cookie, recoveryCodes } = await enrolled()
    expect((await post('/v1/auth/mfa/disable', cookie, { currentPassword: 'wrong-password-1', code: recoveryCodes[0] })).statusCode).toBe(401)
    expect((await post('/v1/auth/mfa/disable', cookie, { currentPassword: PASSWORD, code: '000000' })).statusCode).toBe(400)

    const off = await post('/v1/auth/mfa/disable', cookie, { currentPassword: PASSWORD, code: recoveryCodes[1] })
    expect(off.statusCode).toBe(200)
    const row = (await db.query.users.findFirst({ where: eq(users.email, email) }))!
    expect(row).toMatchObject({ mfaSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [] })
    expect((await login(email)).json().user.email).toBe(email)
    expect(sendEmail.mock.calls.some(([m]) => m.to === email && m.heading === 'Two-step sign-in turned off')).toBe(true)
  })
})
