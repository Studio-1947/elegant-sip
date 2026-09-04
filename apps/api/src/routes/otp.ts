import { randomBytes, randomInt } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { and, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '../db/client.js'
import { otpChallenges, users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { ApiError } from '../lib/problem.js'
import { SESSION_COOKIE, createSession, sessionCookieOptions } from '../lib/sessions.js'
import { ARGON2, limit, publicUserSchema, toPublicUser } from './auth-shared.js'

const phoneSchema = z.string().trim().max(20)
const codeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.')
const response = z.object({ ok: z.literal(true), challengeId: z.string().uuid().optional() })
const normalisePhone = (input: string) => {
  const digits = input.replace(/\D/g, '')
  const local = digits.startsWith('91') && digits.length === 12 ? digits.slice(2) : digits
  if (!/^[6-9]\d{9}$/.test(local)) throw ApiError.badRequest('Enter a valid Indian WhatsApp number.')
  return `+91${local}`
}
async function sendOtp(phone: string, code: string, challengeId: string) {
  if (env.AUTH_OTP_PROVIDER !== 'interakt' || !env.INTERAKT_API_KEY) {
    throw new ApiError(503, 'otp_unavailable', 'WhatsApp sign-in unavailable', 'WhatsApp sign-in is being prepared. Please use email and password for now.')
  }
  const result = await fetch(`${env.INTERAKT_API_BASE_URL.replace(/\/$/, '')}/message/`, {
    method: 'POST',
    headers: { Authorization: `Basic ${env.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.slice(3), type: 'Template', callbackData: `otp:${challengeId}`, template: { name: env.INTERAKT_OTP_TEMPLATE, languageCode: env.INTERAKT_OTP_TEMPLATE_LANGUAGE, bodyValues: [code] } }),
  })
  if (!result.ok) throw new ApiError(503, 'otp_delivery_failed', 'WhatsApp sign-in unavailable', 'We could not send a WhatsApp code. Please try again shortly.')
}
async function issue(userId: string | null, phone: string, purpose: 'phone_login' | 'phone_link') {
  const code = String(randomInt(100000, 1_000_000))
  const [challenge] = await db.insert(otpChallenges).values({ userId, phone, purpose, codeHash: await hash(code, ARGON2), expiresAt: new Date(Date.now() + 10 * 60_000) }).returning({ id: otpChallenges.id })
  await sendOtp(phone, code, challenge.id)
  return challenge.id
}
async function consume(id: string, code: string, purpose: 'phone_login' | 'phone_link', userId?: string) {
  const row = await db.query.otpChallenges.findFirst({ where: and(eq(otpChallenges.id, id), eq(otpChallenges.purpose, purpose), isNull(otpChallenges.consumedAt), gt(otpChallenges.expiresAt, new Date())) })
  if (!row || (userId && row.userId !== userId) || row.attempts >= 5 || !(await verify(row.codeHash, code))) {
    if (row) await db.update(otpChallenges).set({ attempts: row.attempts + 1 }).where(eq(otpChallenges.id, row.id))
    throw ApiError.badRequest('That code is invalid or has expired. Request a new one.')
  }
  await db.update(otpChallenges).set({ consumedAt: new Date() }).where(eq(otpChallenges.id, row.id))
  return row
}
export const otpRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post('/auth/whatsapp/request', { config: limit(5, '10 minutes'), schema: { tags: ['Auth'], body: z.object({ phone: phoneSchema }), response: { 200: response } } }, async (request) => {
    const phone = normalisePhone(request.body.phone)
    const user = await db.query.users.findFirst({ where: and(eq(users.phone, phone), isNotNull(users.phoneVerifiedAt)) })
    // A new phone receives an account-creation challenge; an existing phone
    // receives a sign-in challenge. The response intentionally stays identical.
    return { ok: true as const, challengeId: await issue(user?.id ?? null, phone, 'phone_login') }
  })
  app.post('/auth/whatsapp/verify', { config: limit(10, '10 minutes'), schema: { tags: ['Auth'], body: z.object({ challengeId: z.string().uuid(), code: codeSchema }), response: { 200: z.object({ user: publicUserSchema }) } } }, async (request, reply) => {
    const challenge = await consume(request.body.challengeId, request.body.code, 'phone_login')
    let user = challenge.userId ? await db.query.users.findFirst({ where: eq(users.id, challenge.userId) }) : null
    if (!user) {
      const local = challenge.phone.slice(1)
      const [created] = await db.insert(users).values({
        name: 'Tea Lover',
        // Email remains an internal required column for legacy password flows.
        // This reserved domain is never mailed and is not shown as a contact address.
        email: `whatsapp-${local}@whatsapp.elegantsip.invalid`,
        passwordHash: await hash(randomBytes(32).toString('base64url'), ARGON2),
        phone: challenge.phone,
        phoneVerifiedAt: new Date(),
      }).returning()
      user = created
    }
    if (!user) throw ApiError.badRequest('That code is invalid or has expired. Request a new one.')
    reply.setCookie(SESSION_COOKIE, await createSession({ userId: user.id, email: user.email, role: user.role }), sessionCookieOptions(request.hostname))
    return { user: toPublicUser(user) }
  })
  app.post('/account/whatsapp/request', { config: limit(5, '10 minutes'), schema: { tags: ['Account'], body: z.object({ phone: phoneSchema }), response: { 200: response } } }, async (request) => {
    if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    const phone = normalisePhone(request.body.phone)
    const existing = await db.query.users.findFirst({ where: eq(users.phone, phone) })
    if (existing && existing.id !== request.session.userId) throw ApiError.conflict('phone_in_use', 'That WhatsApp number is already linked to another account.')
    return { ok: true as const, challengeId: await issue(request.session.userId, phone, 'phone_link') }
  })
  app.post('/account/whatsapp/verify', { config: limit(10, '10 minutes'), schema: { tags: ['Account'], body: z.object({ challengeId: z.string().uuid(), code: codeSchema }), response: { 200: response } } }, async (request) => {
    if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    const challenge = await consume(request.body.challengeId, request.body.code, 'phone_link', request.session.userId)
    await db.update(users).set({ phone: challenge.phone, phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, request.session.userId))
    return { ok: true as const }
  })
}
