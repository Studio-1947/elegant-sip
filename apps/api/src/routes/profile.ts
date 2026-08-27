import { hash, verify } from '@node-rs/argon2'
import { eq, ne, and } from 'drizzle-orm'
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
  sessionCookieOptions,
} from '../lib/sessions.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../env.js'
import {
  ARGON2,
  emailSchema,
  passwordSchema,
  publicUserSchema,
  limit,
  sendVerificationEmail,
  strictLimit,
  toPublicUser,
} from './auth-shared.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Managing your own account, once signed in.
 *
 * Every route here requires a session, which changes the threat model from the
 * one in auth.ts. There, the caller is a stranger and the danger is enumeration
 * — so those endpoints reveal nothing. Here the caller is already someone, and
 * the danger is that they are someone who stole a session.
 *
 * Hence the rule this file follows: anything that could be used to take an
 * account over permanently — changing the password, changing the address that
 * receives reset links — asks for the current password again, and tells the old
 * address what happened. A stolen session alone is then not enough.
 * ──────────────────────────────────────────────────────────────────────────── */

function requireSession(session: { userId: string } | null) {
  if (!session) {
    throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
  }
  return session
}

/** Loads the signed-in user, or fails if the session outlived the account. */
async function currentUser(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) {
    throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in again to continue.')
  }
  return user
}

/** Rejects unless the supplied password is the account's current one. */
async function assertPassword(digest: string, password: string) {
  let ok = false
  try {
    ok = await verify(digest, password)
  } catch {
    ok = false
  }
  if (!ok) {
    throw new ApiError(
      401,
      'invalid_credentials',
      'Password incorrect',
      'That is not your current password.',
    )
  }
}

export const profileRoutes: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/auth/me',
    {
      schema: {
        tags: ['Account'],
        summary: 'Update your name',
        description:
          'Only the display name. Changing the email address is a separate endpoint because it can be used to take an account over, and so needs the password.',
        body: z.object({ name: z.string().trim().min(2).max(80) }),
        response: { 200: z.object({ user: publicUserSchema }), 401: problemSchema },
      },
    },
    async (request) => {
      const session = requireSession(request.session)
      const [updated] = await db
        .update(users)
        .set({ name: request.body.name, updatedAt: new Date() })
        .where(eq(users.id, session.userId))
        .returning()
      if (!updated) {
        throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in again to continue.')
      }
      return { user: toPublicUser(updated) }
    },
  )

  app.post(
    '/auth/password/change',
    {
      config: strictLimit,
      schema: {
        tags: ['Account'],
        summary: 'Change your password',
        description:
          'Signs out every other device and issues this one a fresh session, so a stolen session cannot survive the change that was meant to defeat it.',
        body: z.object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema }),
        response: {
          200: z.object({ ok: z.literal(true) }),
          400: problemSchema,
          401: problemSchema,
        },
      },
    },
    async (request, reply) => {
      const session = requireSession(request.session)
      const user = await currentUser(session.userId)
      await assertPassword(user.passwordHash, request.body.currentPassword)

      if (request.body.newPassword === request.body.currentPassword) {
        throw ApiError.badRequest('That is already your password. Choose a different one.')
      }

      const passwordHash = await hash(request.body.newPassword, ARGON2)
      await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))

      /*
       * Every session goes, including this one — the whole point is that anyone
       * else holding one loses it. This device is then signed straight back in,
       * so changing a password does not eject the person who chose to change it.
       */
      await destroyAllSessionsFor(user.id)
      const token = await createSession({ userId: user.id, email: user.email, role: user.role })
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(request.hostname))

      // Told, not asked: if this was not them, they need to know immediately.
      await sendEmail({
        to: user.email,
        subject: 'Your Elegant Sip password was changed',
        heading: 'Password changed',
        body: [
          `Hello ${user.name},`,
          'The password on your account was just changed, and every other signed-in device was signed out.',
          'If this was not you, reset your password now — whoever did it has been signed out already.',
        ],
        action: { label: 'Go to my account', url: `${env.SITE_URL}/account` },
      })

      return { ok: true as const }
    },
  )

  app.post(
    '/auth/email/change',
    {
      config: strictLimit,
      schema: {
        tags: ['Account'],
        summary: 'Change your email address',
        description:
          'Requires the current password, because whoever receives password-reset links controls the account. The new address starts unverified and is sent a confirmation link.',
        body: z.object({ newEmail: emailSchema, currentPassword: z.string().min(1).max(200) }),
        response: {
          200: z.object({ user: publicUserSchema }),
          400: problemSchema,
          401: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const session = requireSession(request.session)
      const user = await currentUser(session.userId)
      await assertPassword(user.passwordHash, request.body.currentPassword)

      const newEmail = request.body.newEmail
      if (newEmail === user.email) {
        throw ApiError.badRequest('That is already your email address.')
      }

      /*
       * This does reveal that an address is registered, unlike /auth/register.
       * The trade is deliberate: the caller has already proved they hold this
       * account and its password, the endpoint is rate-limited, and the
       * alternative — silently appearing to succeed — would leave someone
       * staring at an address change that never happened.
       */
      const taken = await db.query.users.findFirst({
        where: and(eq(users.email, newEmail), ne(users.id, user.id)),
      })
      if (taken) {
        throw new ApiError(
          409,
          'email_taken',
          'Address unavailable',
          'That email address is already in use on another account.',
        )
      }

      const previousEmail = user.email
      const [updated] = await db
        .update(users)
        .set({ email: newEmail, emailVerifiedAt: null, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning()

      await sendVerificationEmail({ id: user.id, email: newEmail, name: user.name })

      /* The old address is told too — it is the only place a hijack is visible
         to the real owner once the new address is under someone else's control. */
      await sendEmail({
        to: previousEmail,
        subject: 'Your Elegant Sip email address was changed',
        heading: 'Email address changed',
        body: [
          `Hello ${user.name},`,
          `The address on your account was changed to ${newEmail}.`,
          'If this was not you, contact us immediately — this address will no longer receive account emails.',
        ],
      })

      return { user: toPublicUser(updated) }
    },
  )

  app.post(
    '/auth/verify-email/resend',
    {
      config: limit(3, '10 minutes'),
      schema: {
        tags: ['Account'],
        summary: 'Send the confirmation email again',
        description:
          'For when the first one did not arrive. Reports success even when the address is already confirmed, so the response never becomes a way to probe account state.',
        response: { 200: z.object({ ok: z.literal(true) }), 401: problemSchema },
      },
    },
    async (request) => {
      const session = requireSession(request.session)
      const user = await currentUser(session.userId)
      if (user.emailVerifiedAt === null) {
        await sendVerificationEmail({ id: user.id, email: user.email, name: user.name })
      }
      return { ok: true as const }
    },
  )

  app.post(
    '/auth/logout-all',
    {
      schema: {
        tags: ['Account'],
        summary: 'Sign out everywhere',
        description: 'Ends every session for this account, this device included.',
        response: { 200: z.object({ ok: z.literal(true) }), 401: problemSchema },
      },
    },
    async (request, reply) => {
      const session = requireSession(request.session)
      await destroyAllSessionsFor(session.userId)
      const { maxAge: _discard, ...clearOptions } = sessionCookieOptions(request.hostname)
      reply.clearCookie(SESSION_COOKIE, clearOptions)
      return { ok: true as const }
    },
  )
}
