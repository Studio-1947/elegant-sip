import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'

const INTERAKT_URL = vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  const base = 'https://interakt.test/v1/public'
  process.env.AUTH_OTP_PROVIDER = 'interakt'
  process.env.INTERAKT_API_KEY = 'test-interakt-key'
  process.env.INTERAKT_API_BASE_URL = base
  return base
})

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { otpChallenges } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { redis } from '../lib/sessions.js'

/* WhatsApp one-time codes: per-number limits, single use, atomic guessing. */

let app: FastifyInstance
let available = true

/** Codes "delivered" through the stubbed Interakt API, newest last. */
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
})

/** A fresh, valid Indian mobile, so earlier runs never share a budget. */
const freshPhone = () => `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`
const WRONG = '000000' // Real codes are 100000–999999.

async function requestCode(phone: string, cookie?: string, url = '/v1/auth/whatsapp/request') {
  const res = await app.inject({ method: 'POST', url, payload: { phone }, ...(cookie ? { headers: { cookie } } : {}) })
  const code = res.statusCode === 200 ? sent.findLast((s) => s.phoneNumber === phone)?.code : undefined
  return { res, challengeId: res.json().challengeId as string | undefined, code }
}

const verify = (challengeId: string, code: string, cookie?: string, url = '/v1/auth/whatsapp/verify') =>
  app.inject({ method: 'POST', url, payload: { challengeId, code }, ...(cookie ? { headers: { cookie } } : {}) })

const attemptsOf = async (id: string) =>
  (await db.query.otpChallenges.findFirst({ where: eq(otpChallenges.id, id) }))!

async function signedInCookie() {
  const email = `otp.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
  const password = 'correct-horse-battery'
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name: 'Otp Tester', email, password } })
  const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
  return `es_session=${login.cookies.find((c) => c.name === 'es_session')!.value}`
}

describe('GET /v1/auth/methods', () => {
  it('reports WhatsApp only when codes can actually be sent, cacheably', async () => {
    if (!available) return
    const on = await app.inject({ method: 'GET', url: '/v1/auth/methods' })
    expect(on.statusCode).toBe(200)
    expect(on.json()).toEqual({ whatsapp: true })
    expect(on.headers['cache-control']).toBe('public, max-age=60')

    const saved = env.AUTH_OTP_PROVIDER
    env.AUTH_OTP_PROVIDER = 'disabled'
    try {
      expect((await app.inject({ method: 'GET', url: '/v1/auth/methods' })).json()).toEqual({ whatsapp: false })
      // And a request then fails before spending anything or calling out.
      const phone = freshPhone()
      const { res } = await requestCode(phone)
      expect(res.statusCode).toBe(503)
      expect(res.json().type).toBe('otp_unavailable')
      expect(await db.query.otpChallenges.findFirst({ where: eq(otpChallenges.phone, `+91${phone}`) })).toBeUndefined()
      expect(sent).toHaveLength(0)
    } finally {
      env.AUTH_OTP_PROVIDER = saved
    }
  })
})

describe('WhatsApp code requests', () => {
  it('caps codes per number at 3 per 10 minutes, whatever the address', async () => {
    if (!available) return
    const phone = freshPhone()
    for (let i = 0; i < 3; i++) {
      const res = await app.inject({ method: 'POST', url: '/v1/auth/whatsapp/request', payload: { phone }, remoteAddress: `10.77.0.${i + 1}` })
      expect(res.statusCode).toBe(200)
    }
    const fourth = await app.inject({ method: 'POST', url: '/v1/auth/whatsapp/request', payload: { phone }, remoteAddress: '10.77.0.99' })
    expect(fourth.statusCode).toBe(429)
    expect(fourth.json()).toMatchObject({ type: 'otp_rate_limited', status: 429 })
    expect(fourth.json().detail).toMatch(/wait a few minutes/)
    expect(sent.filter((s) => s.phoneNumber === phone)).toHaveLength(3)

    // Another number is unaffected.
    expect((await requestCode(freshPhone())).res.statusCode).toBe(200)
  })

  it('serialises simultaneous requests so they cannot all slip under the cap', async () => {
    if (!available) return
    const phone = freshPhone()
    const results = await Promise.all(
      Array.from({ length: 6 }, () => app.inject({ method: 'POST', url: '/v1/auth/whatsapp/request', payload: { phone } })),
    )
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(3)
    expect(results.filter((r) => r.statusCode === 429)).toHaveLength(3)
  })

  it('invalidates the previous code when a new one is issued', async () => {
    if (!available) return
    const phone = freshPhone()
    const first = await requestCode(phone)
    const second = await requestCode(phone)
    expect(first.challengeId).not.toBe(second.challengeId)

    expect((await verify(first.challengeId!, first.code!)).statusCode).toBe(400)
    const ok = await verify(second.challengeId!, second.code!)
    expect(ok.statusCode).toBe(200)
    expect(ok.json().user.phone).toBe(`+91${phone}`)
  })
})

describe('WhatsApp code verification', () => {
  it('signs in once with the right code and never again with the same one', async () => {
    if (!available) return
    const phone = freshPhone()
    const { challengeId, code } = await requestCode(phone)
    expect((await verify(challengeId!, WRONG)).statusCode).toBe(400)

    // Two simultaneous uses of the right code: exactly one wins.
    const both = await Promise.all([verify(challengeId!, code!), verify(challengeId!, code!)])
    expect(both.map((r) => r.statusCode).sort()).toEqual([200, 400])
    const ok = both.find((r) => r.statusCode === 200)!
    expect(ok.cookies.some((c) => c.name === 'es_session')).toBe(true)

    const reuse = await verify(challengeId!, code!)
    expect(reuse.statusCode).toBe(400)
    expect(reuse.cookies.some((c) => c.name === 'es_session')).toBe(false)

    const row = await attemptsOf(challengeId!)
    expect(row.consumedAt).not.toBeNull()
    // Only failures are counted against the number: the one wrong guess.
    expect(row.attempts).toBe(1)
  })

  it('locks a code after 5 wrong guesses, even when they arrive at once', async () => {
    if (!available) return
    const phone = freshPhone()
    const { challengeId, code } = await requestCode(phone)

    const guesses = await Promise.all(Array.from({ length: 8 }, () => verify(challengeId!, WRONG)))
    expect(guesses.every((r) => r.statusCode === 400)).toBe(true)
    const row = await attemptsOf(challengeId!)
    expect(row.attempts).toBeLessThanOrEqual(5)
    expect(row.attempts).toBe(5)

    // Locked: the right code no longer works either.
    expect((await verify(challengeId!, code!)).statusCode).toBe(400)
    expect((await attemptsOf(challengeId!)).consumedAt).toBeNull()
  })

  it('stops a number after 10 wrong guesses in a day, across codes', async () => {
    if (!available) return
    const phone = freshPhone()
    const a = await requestCode(phone)
    for (let i = 0; i < 5; i++) expect((await verify(a.challengeId!, WRONG)).statusCode).toBe(400)
    const b = await requestCode(phone)
    for (let i = 0; i < 4; i++) expect((await verify(b.challengeId!, WRONG)).statusCode).toBe(400)
    const c = await requestCode(phone)
    expect(c.res.statusCode).toBe(200)
    expect((await verify(c.challengeId!, WRONG)).statusCode).toBe(400) // tenth failure

    // The budget is spent: even the right code is refused...
    const refused = await verify(c.challengeId!, c.code!)
    expect(refused.statusCode).toBe(429)
    expect(refused.json().type).toBe('otp_rate_limited')
    // ...and no further codes are sent to the number.
    await db.update(otpChallenges).set({ createdAt: new Date(Date.now() - 11 * 60_000) }).where(eq(otpChallenges.phone, `+91${phone}`))
    const more = await requestCode(phone)
    expect(more.res.statusCode).toBe(429)
    expect(more.res.json().detail).toMatch(/incorrect codes/)
  })

  it('only lets the account that asked use a link code', async () => {
    if (!available) return
    const owner = await signedInCookie()
    const other = await signedInCookie()
    const phone = freshPhone()
    const { res, challengeId, code } = await requestCode(phone, owner, '/v1/account/whatsapp/request')
    expect(res.statusCode).toBe(200)

    expect((await verify(challengeId!, code!, other, '/v1/account/whatsapp/verify')).statusCode).toBe(400)
    // The stranger's attempt did not burn one of the owner's guesses.
    expect((await attemptsOf(challengeId!)).attempts).toBe(0)
    expect((await verify(challengeId!, code!, owner, '/v1/account/whatsapp/verify')).statusCode).toBe(200)
  })
})
