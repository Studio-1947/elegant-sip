import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { sql } from '../db/client.js'
import { redis } from '../lib/sessions.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Account management.
 *
 * These test the properties that make the endpoints safe rather than merely
 * working: that a stolen session cannot be used to take an account over, and
 * that changing a password really does evict everyone else.
 * ──────────────────────────────────────────────────────────────────────────── */

let app: FastifyInstance

const PASSWORD = 'correct-horse-battery'
const NEW_PASSWORD = 'a-different-long-password'

const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`

async function signUp(email: string, name = 'Test Person') {
  await app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name, email, password: PASSWORD } })
  return signIn(email, PASSWORD)
}

async function signIn(email: string, password: string) {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password } })
  const cookie = res.cookies.find((c) => c.name === 'es_session')
  return { status: res.statusCode, cookie: cookie ? `es_session=${cookie.value}` : null }
}

const whoami = (cookie: string) =>
  app.inject({ method: 'GET', url: '/v1/auth/me', headers: { cookie } })

beforeAll(async () => {
  app = await buildApp()
})

afterAll(async () => {
  await app.close()
  await sql.end({ timeout: 5 })
  redis.disconnect()
})

describe('changing your name', () => {
  it('updates it and hands back the new user', async () => {
    const email = unique('rename')
    const { cookie } = await signUp(email)
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/auth/me',
      headers: { cookie: cookie! },
      payload: { name: 'Renamed Person' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.name).toBe('Renamed Person')
    expect((await whoami(cookie!)).json().user.name).toBe('Renamed Person')
  })

  it('refuses without a session', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/v1/auth/me', payload: { name: 'Nobody' } })
    expect(res.statusCode).toBe(401)
  })
})

describe('changing your password', () => {
  it('requires the current one', async () => {
    const email = unique('wrongcurrent')
    const { cookie } = await signUp(email)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change',
      headers: { cookie: cookie! },
      payload: { currentPassword: 'not-the-password', newPassword: NEW_PASSWORD },
    })
    expect(res.statusCode).toBe(401)
    // The old password must still work — nothing changed.
    expect((await signIn(email, PASSWORD)).status).toBe(200)
  })

  it('signs out other devices but keeps this one', async () => {
    const email = unique('evict')
    const { cookie: deviceA } = await signUp(email)
    const { cookie: deviceB } = await signIn(email, PASSWORD)
    expect((await whoami(deviceB!)).json().user).not.toBeNull()

    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change',
      headers: { cookie: deviceA! },
      payload: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
    })
    expect(res.statusCode).toBe(200)

    // The other device is gone.
    expect((await whoami(deviceB!)).json().user).toBeNull()

    // This one was re-issued rather than evicted alongside it.
    const reissued = res.cookies.find((c) => c.name === 'es_session')
    expect(reissued).toBeDefined()
    expect((await whoami(`es_session=${reissued!.value}`)).json().user).not.toBeNull()

    // And the new password is the one that works.
    expect((await signIn(email, PASSWORD)).status).toBe(401)
    expect((await signIn(email, NEW_PASSWORD)).status).toBe(200)
  })

  it('rejects a new password identical to the old one', async () => {
    const email = unique('samepassword')
    const { cookie } = await signUp(email)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/password/change',
      headers: { cookie: cookie! },
      payload: { currentPassword: PASSWORD, newPassword: PASSWORD },
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('changing your email address', () => {
  it('needs the password, because it can be used to take the account over', async () => {
    const email = unique('hijack')
    const { cookie } = await signUp(email)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/change',
      headers: { cookie: cookie! },
      payload: { newEmail: unique('attacker'), currentPassword: 'guessing' },
    })
    expect(res.statusCode).toBe(401)
    expect((await whoami(cookie!)).json().user.email).toBe(email)
  })

  it('moves the address and marks it unverified again', async () => {
    const email = unique('moving')
    const next = unique('moved')
    const { cookie } = await signUp(email)
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/change',
      headers: { cookie: cookie! },
      payload: { newEmail: next, currentPassword: PASSWORD },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().user.email).toBe(next)
    expect(res.json().user.emailVerified).toBe(false)
    // Sign-in follows the address.
    expect((await signIn(next, PASSWORD)).status).toBe(200)
    expect((await signIn(email, PASSWORD)).status).toBe(401)
  })

  it('refuses an address another account already holds', async () => {
    const taken = unique('occupied')
    await signUp(taken)
    const { cookie } = await signUp(unique('mover'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/email/change',
      headers: { cookie: cookie! },
      payload: { newEmail: taken, currentPassword: PASSWORD },
    })
    expect(res.statusCode).toBe(409)
  })
})

describe('signing out everywhere', () => {
  it('ends every session including the current one', async () => {
    const email = unique('logoutall')
    const { cookie: deviceA } = await signUp(email)
    const { cookie: deviceB } = await signIn(email, PASSWORD)

    const res = await app.inject({ method: 'POST', url: '/v1/auth/logout-all', headers: { cookie: deviceA! } })
    expect(res.statusCode).toBe(200)

    expect((await whoami(deviceA!)).json().user).toBeNull()
    expect((await whoami(deviceB!)).json().user).toBeNull()
  })

  it('refuses without a session', async () => {
    expect((await app.inject({ method: 'POST', url: '/v1/auth/logout-all' })).statusCode).toBe(401)
  })
})

describe('resending the confirmation email', () => {
  it('succeeds for a signed-in customer', async () => {
    const { cookie } = await signUp(unique('resend'))
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/verify-email/resend',
      headers: { cookie: cookie! },
    })
    expect(res.statusCode).toBe(200)
  })

  it('refuses without a session', async () => {
    expect(
      (await app.inject({ method: 'POST', url: '/v1/auth/verify-email/resend' })).statusCode,
    ).toBe(401)
  })
})
