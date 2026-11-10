import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'
import type { EmailMessage } from '../lib/email.js'

// Every email is recorded instead of sent.
const sendEmail = vi.hoisted(() => vi.fn(async (_message: EmailMessage) => ({ delivered: false })))
vi.mock('../lib/email.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/email.js')>()), sendEmail }))

import { buildApp } from '../app.js'
import { sql } from '../db/client.js'
import { env } from '../env.js'
import { redis } from '../lib/sessions.js'

/* Registration must not reveal, by body or by effort, which addresses have accounts. */

let app: FastifyInstance
let available = true

const PASSWORD = 'correct-horse-battery'
const unique = (label: string) => `${label}.${Date.now()}.${Math.round(performance.now() * 1000)}@example.test`
const register = (email: string, password = PASSWORD, name = 'Reg Tester') =>
  app.inject({ method: 'POST', url: '/v1/auth/register', payload: { name, email, password } })

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

beforeEach(() => {
  sendEmail.mockClear()
})

describe('POST /v1/auth/register', () => {
  it('answers a new and a taken address identically, emailing the address both times', async () => {
    if (!available) return
    const email = unique('reg')

    const fresh = await register(email)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toMatchObject({ to: email, subject: 'Confirm your Elegant Sip account' })

    sendEmail.mockClear()
    const taken = await register(email, 'someone-elses-password', 'Intruder')
    expect(taken.statusCode).toBe(fresh.statusCode)
    expect(taken.statusCode).toBe(200)
    expect(taken.body).toBe(fresh.body)
    expect(taken.json()).toEqual({ ok: true })

    // The owner hears about the attempt, with a way back in.
    expect(sendEmail).toHaveBeenCalledTimes(1)
    const notice = sendEmail.mock.calls[0][0]
    expect(notice).toMatchObject({ to: email, subject: 'Your Elegant Sip account' })
    expect(notice.body.join(' ')).toContain('Forgot your password?')
    expect(notice.action?.url).toBe(`${env.SITE_URL}/`)

    // And nothing about the account changed.
    const original = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: PASSWORD } })
    expect(original.statusCode).toBe(200)
    expect(original.json().user.name).toBe('Reg Tester')
    const intruder = await app.inject({ method: 'POST', url: '/v1/auth/login', payload: { email, password: 'someone-elses-password' } })
    expect(intruder.statusCode).toBe(401)
  })

  it('refuses the placeholder domain reserved for WhatsApp-only accounts', async () => {
    if (!available) return
    const res = await register(`9876543210${Date.now()}@whatsapp.elegantsip.invalid`)
    expect(res.statusCode).toBe(400)
    expect(sendEmail).not.toHaveBeenCalled()
  })
})
