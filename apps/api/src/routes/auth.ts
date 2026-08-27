import { timingSafeEqual } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { users } from '../db/schema-commerce.js'
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
import {
  ARGON2,
  consumeToken,
  strictLimit,
  emailSchema,
  issueToken,
  passwordSchema,
  publicUserSchema,
  sendVerificationEmail,
  toPublicUser,
} from './auth-shared.js'

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

export const authRoutes: FastifyPluginAsyncZod = async (app) => {
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
          await sendVerificationEmail({ id: user.id, email, name })
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
        return { user: toPublicUser(user) }
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
      return { user: toPublicUser(user) }
    },
  )
}

/** Constant-time compare for any future signature checks in this module. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}
