import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { authTokens, users } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import {
  SESSION_COOKIE,
  createSession,
  destroyAllSessionsFor,
  destroySession,
  sessionCookieOptions,
} from '../lib/sessions.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Identity.
 *
 * Replaces the demo auth that accepted any password. Three things matter here:
 *
 *  · Argon2id, not a fast hash. Its parameters are deliberately expensive.
 *  · Registration and password-reset requests reveal nothing about whether an
 *    address exists. Both always report success — otherwise the endpoint is an
 *    account-enumeration oracle.
 *  · Changing a password destroys every existing session for that user.
 * ──────────────────────────────────────────────────────────────────────────── */

// OWASP-recommended baseline for interactive logins.
const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .describe('Minimum 10 characters. Length beats complexity rules.')

const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['customer', 'admin']),
  emailVerified: z.boolean(),
})

const TOKEN_TTL_MS = { email_verification: 24 * 60 * 60 * 1000, password_reset: 60 * 60 * 1000 }

/** Stores only a hash — a database dump must not yield working links. */
async function issueToken(userId: string, purpose: 'email_verification' | 'password_reset') {
  const token = randomBytes(32).toString('base64url')
  await db.insert(authTokens).values({
    userId,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  })
  return token
}

async function consumeToken(token: string, purpose: 'email_verification' | 'password_reset') {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const row = await db.query.authTokens.findFirst({
    where: and(eq(authTokens.tokenHash, tokenHash), eq(authTokens.purpose, purpose), isNull(authTokens.consumedAt)),
  })
  if (!row || row.expiresAt.getTime() < Date.now()) return null
  await db.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, row.id))
  return row.userId
}

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
  /* Auth endpoints are the ones worth brute-forcing, so they carry a tighter
     limit than the global one. */
  const strictLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } }

  app.post(
      '/auth/register',
      {
        config: strictLimit,
      schema: {
          tags: ['Auth'],
          summary: 'Create an account',
          description:
            'Always reports success, even if the address is already registered — a different response would let anyone test which addresses have accounts.',
          body: z.object({ name: z.string().trim().min(2).max(80), email: emailSchema, password: passwordSchema }),
          response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema },
        },
      },
      async (request) => {
        const { name, email, password } = request.body
        const existing = await db.query.users.findFirst({ where: eq(users.email, email) })

        if (!existing) {
          const passwordHash = await hash(password, ARGON2)
          const [user] = await db.insert(users).values({ name, email, passwordHash }).returning({ id: users.id })
          const token = await issueToken(user.id, 'email_verification')
          await sendEmail({
            to: email,
            subject: 'Confirm your Elegant Sip account',
            heading: 'One tap to confirm',
            body: [
              `Welcome, ${name}.`,
              'Confirm this address and your account is ready. The link is good for 24 hours.',
            ],
            action: { label: 'Confirm my email', url: `${env.SITE_URL}/verify-email?token=${token}` },
          })
        }
        // Same response either way.
        return { ok: true as const }
      },
    )

  app.post(
      '/auth/login',
      {
        config: strictLimit,
      schema: {
          tags: ['Auth'],
          summary: 'Sign in',
          body: z.object({ email: emailSchema, password: z.string().min(1).max(200) }),
          response: { 200: z.object({ user: publicUserSchema }), 401: problemSchema },
        },
      },
      async (request, reply) => {
        const { email, password } = request.body
        const user = await db.query.users.findFirst({ where: eq(users.email, email) })

        /* Hash even when the user does not exist, so response timing does not
           reveal which addresses are registered. */
        const digest = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000'
        let ok = false
        try {
          ok = await verify(digest, password)
        } catch {
          ok = false
        }

        if (!user || !ok) {
          throw new ApiError(401, 'invalid_credentials', 'Sign-in failed', 'That email and password do not match.')
        }

        const token = await createSession({ userId: user.id, email: user.email, role: user.role })
        reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(request.hostname))
        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            emailVerified: user.emailVerifiedAt !== null,
          },
        }
      },
    )

  app.post(
      '/auth/password/forgot',
      {
        config: strictLimit,
      schema: {
          tags: ['Auth'],
          summary: 'Request a password reset',
          description: 'Always reports success — see /auth/register for why.',
          body: z.object({ email: emailSchema }),
          response: { 200: z.object({ ok: z.literal(true) }) },
        },
      },
      async (request) => {
        const user = await db.query.users.findFirst({ where: eq(users.email, request.body.email) })
        if (user) {
          const token = await issueToken(user.id, 'password_reset')
          await sendEmail({
            to: user.email,
            subject: 'Reset your Elegant Sip password',
            heading: 'Set a new password',
            body: [
              'We received a request to reset your password. The link below works once, and expires in an hour.',
              'If this was not you, nothing has changed and you can ignore this message.',
            ],
            action: { label: 'Choose a new password', url: `${env.SITE_URL}/reset-password?token=${token}` },
          })
        }
        return { ok: true as const }
      },
    )

  app.post(
    '/auth/password/reset',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Complete a password reset',
        description: 'Consumes the token and destroys every existing session for that account.',
        body: z.object({ token: z.string().min(1), password: passwordSchema }),
        response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema },
      },
    },
    async (request) => {
      const userId = await consumeToken(request.body.token, 'password_reset')
      if (!userId) {
        throw ApiError.badRequest('That reset link has expired or has already been used. Request a new one.')
      }
      const passwordHash = await hash(request.body.password, ARGON2)
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
      // Anyone holding a stolen session loses it here.
      await destroyAllSessionsFor(userId)
      return { ok: true as const }
    },
  )

  app.post(
    '/auth/verify-email',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Confirm an email address',
        body: z.object({ token: z.string().min(1) }),
        response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema },
      },
    },
    async (request) => {
      const userId = await consumeToken(request.body.token, 'email_verification')
      if (!userId) {
        throw ApiError.badRequest('That confirmation link has expired or has already been used.')
      }
      await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId))
      return { ok: true as const }
    },
  )

  app.post(
    '/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Sign out',
        response: { 200: z.object({ ok: z.literal(true) }) },
      },
    },
    async (request, reply) => {
      await destroySession(request.cookies[SESSION_COOKIE])
      /*
       * Cleared with the same attributes it was set with — a cross-site cookie
       * cleared with default (Lax) attributes is ignored by the browser, so the
       * stale cookie would survive sign-out.
       */
      const { maxAge: _discard, ...clearOptions } = sessionCookieOptions(request.hostname)
      reply.clearCookie(SESSION_COOKIE, clearOptions)
      return { ok: true as const }
    },
  )

  app.get(
    '/auth/me',
    {
      schema: {
        tags: ['Auth'],
        summary: 'The signed-in customer',
        response: { 200: z.object({ user: publicUserSchema.nullable() }) },
      },
    },
    async (request) => {
      if (!request.session) return { user: null }
      const user = await db.query.users.findFirst({ where: eq(users.id, request.session.userId) })
      if (!user) return { user: null }
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerifiedAt !== null,
        },
      }
    },
  )
}

/** Constant-time compare for any future signature checks in this module. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
