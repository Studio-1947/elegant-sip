import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { hash } from '@node-rs/argon2'

vi.hoisted(() => {
  // env.ts validates at import time, so this must run before any app import.
  process.env.GOOGLE_CLIENT_ID = '1234-test.apps.googleusercontent.com'
})

/* Google's check, stood in for: a token "good:<email>:<name>" is a verified
   Google account; "unverified:<email>" one whose email Google has not verified;
   anything else is rejected, as a forged or expired token would be. */
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    async verifyIdToken({ idToken, audience }: { idToken: string; audience: string }) {
      if (audience !== '1234-test.apps.googleusercontent.com') throw new Error('wrong audience')
      const [kind, email, name] = idToken.split(':')
      if (kind !== 'good' && kind !== 'unverified') throw new Error('invalid token')
      return { getPayload: () => ({ email, name, email_verified: kind === 'good' }) }
    }
  },
}))

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { orders, users } from '../db/schema-commerce.js'
import { redis } from '../lib/sessions.js'
import { ARGON2 } from './auth-shared.js'

let app: FastifyInstance
let available = true

beforeAll(async () => {
  try {
    await sql`SELECT 1`
    await redis.ping()
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

const unique = () => `google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`
const google = (credential: string) => app.inject({ method: 'POST', url: '/v1/auth/google', payload: { credential: credential.padEnd(24, ' ') } })
const sessionCookie = (res: { cookies: { name: string; value: string }[] }) => res.cookies.find((c) => c.name === 'es_session' && c.value)

describe('POST /v1/auth/google', () => {
  it('tells the storefront Google sign-in is on, with the client ID', async () => {
    if (!available) return
    const res = await app.inject('/v1/auth/methods')
    expect(res.json().googleClientId).toBe('1234-test.apps.googleusercontent.com')
  })

  it('creates a confirmed account for a new Google user and signs them in', async () => {
    if (!available) return
    const email = unique()
    const res = await google(`good:${email}:Asha Rai`)
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe(email)
    expect(sessionCookie(res)).toBeTruthy()
    const row = await db.query.users.findFirst({ where: eq(users.email, email) })
    expect(row?.name).toBe('Asha Rai')
    expect(row?.emailVerifiedAt).toBeTruthy()
  })

  it('signs in to the existing account with that email, keeping its password', async () => {
    if (!available) return
    const email = unique()
    const passwordHash = await hash('a-strong-password-123', ARGON2)
    const [existing] = await db.insert(users).values({ email, name: 'Ben', passwordHash, emailVerifiedAt: new Date() }).returning()
    const res = await google(`good:${email}:Someone Else`)
    expect(res.statusCode).toBe(200)
    expect(res.json().user.id).toBe(existing.id)
    const row = await db.query.users.findFirst({ where: eq(users.id, existing.id) })
    expect(row?.passwordHash).toBe(passwordHash)
    expect(row?.name).toBe('Ben')
  })

  it('takes an unconfirmed account back from whoever registered it: new password, address confirmed', async () => {
    if (!available) return
    const email = unique()
    const passwordHash = await hash('attackers-password-1', ARGON2)
    const [existing] = await db.insert(users).values({ email, name: 'Squatter', passwordHash }).returning()
    const res = await google(`good:${email}:Real Owner`)
    expect(res.statusCode).toBe(200)
    const row = await db.query.users.findFirst({ where: eq(users.id, existing.id) })
    expect(row?.passwordHash).not.toBe(passwordHash)
    expect(row?.emailVerifiedAt).toBeTruthy()
    // The old password no longer works.
    const login = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: 'attackers-password-1' } })
    expect(login.statusCode).toBe(401)
  })

  it('attaches guest orders placed with the address', async () => {
    if (!available) return
    const email = unique()
    const guest = await db.query.orders.findFirst({ where: (o, { isNull }) => isNull(o.userId) })
    if (!guest) return // No guest order in this database to borrow.
    const original = guest.email
    await db.update(orders).set({ email }).where(eq(orders.id, guest.id))
    try {
      const res = await google(`good:${email}:Guest Buyer`)
      expect(res.statusCode).toBe(200)
      const after = await db.query.orders.findFirst({ where: eq(orders.id, guest.id) })
      expect(after?.userId).toBe(res.json().user.id)
    } finally {
      await db.update(orders).set({ email: original, userId: null }).where(eq(orders.id, guest.id))
    }
  })

  it('refuses an email Google has not verified, and a token Google rejects', async () => {
    if (!available) return
    const email = unique()
    expect((await google(`unverified:${email}`)).statusCode).toBe(401)
    expect((await google('forged-token-that-google-rejects')).statusCode).toBe(401)
    expect(await db.query.users.findFirst({ where: eq(users.email, email) })).toBeUndefined()
  })

  it('refuses an account with two-step sign-in', async () => {
    if (!available) return
    const email = unique()
    await db.insert(users).values({ email, name: 'Staff', passwordHash: await hash('x-strong-password-1', ARGON2), emailVerifiedAt: new Date(), mfaEnabledAt: new Date() })
    const res = await google(`good:${email}:Staff`)
    expect(res.statusCode).toBe(403)
    expect(sessionCookie(res)).toBeUndefined()
  })
})
