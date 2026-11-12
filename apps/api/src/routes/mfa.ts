import { and, eq, isNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { sendEmail } from '../lib/email.js'
import {
  MFA_ISSUER,
  challengeExpired,
  checkSecondFactor,
  consumeLoginChallenge,
  digestRecoveryCode,
  generateRecoveryCodes,
  mfaKeyConfigured,
  mfaUnavailable,
  readLoginChallenge,
  sealSecret,
  spendChallengeAttempt,
} from '../lib/mfa.js'
import { ApiError } from '../lib/problem.js'
import { SESSION_COOKIE, createSession, destroyAllSessionsFor, sessionCookieOptions } from '../lib/sessions.js'
import { generateTotpSecret, otpauthUri } from '../lib/totp.js'
import { isPlaceholderEmail, publicUserSchema, strictLimit, toPublicUser } from './auth-shared.js'
import { assertPassword, currentUser, requireSession } from './profile.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Two-step sign-in (TOTP) for staff accounts. The mechanics live in lib/mfa.ts.
 *
 * Turning it on or off is as sensitive as changing the password: the setup
 * step and switching it off both ask for the current password, so a stolen
 * session can neither lock the owner out with an authenticator of its own nor
 * quietly remove the second step. Both changes are emailed to the account.
 *
 * WhatsApp sign-in is refused for accounts with two-step sign-in (otp.ts): a
 * code to the phone would otherwise be a way round the authenticator.
 * ──────────────────────────────────────────────────────────────────────────── */

const codeSchema = z.string().trim().min(6).max(32).describe('6-digit authenticator code, or a recovery code where allowed')

const staffOnly = () =>
  new ApiError(403, 'forbidden', 'Staff only', 'Two-step sign-in is available for staff accounts.')

async function notify(user: { email: string; name: string }, heading: string, lines: string[]) {
  if (isPlaceholderEmail(user.email)) return
  await sendEmail({
    to: user.email,
    subject: `Elegant Sip: ${heading.toLowerCase()}`,
    heading,
    body: [`Hello ${user.name},`, ...lines],
    action: { label: 'Go to my account', url: `${env.SITE_URL}/account` },
  })
}

export const mfaRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/auth/mfa',
    {
      schema: {
        tags: ['Account'],
        summary: 'Your two-step sign-in status',
        response: {
          200: z.object({
            /** Staff account, and the server can store secrets. */
            available: z.boolean(),
            enabled: z.boolean(),
            recoveryCodesLeft: z.number().int(),
          }),
          401: problemSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(requireSession(request.session).userId)
      return {
        available: user.role === 'admin' && mfaKeyConfigured(),
        enabled: user.mfaEnabledAt !== null,
        recoveryCodesLeft: user.mfaEnabledAt ? user.mfaRecoveryCodes.length : 0,
      }
    },
  )

  app.post(
    '/auth/mfa/setup',
    {
      config: strictLimit,
      schema: {
        tags: ['Account'],
        summary: 'Start setting up two-step sign-in',
        description:
          'Returns a new authenticator secret and its otpauth:// link. Nothing changes at sign-in until a code from the app is confirmed. Starting again replaces an unconfirmed secret.',
        body: z.object({ currentPassword: z.string().min(1).max(200) }),
        response: {
          200: z.object({ secret: z.string(), otpauthUri: z.string() }),
          401: problemSchema,
          403: problemSchema,
          409: problemSchema,
          503: problemSchema,
        },
      },
    },
    async (request) => {
      const user = await currentUser(requireSession(request.session).userId)
      if (user.role !== 'admin') throw staffOnly()
      if (!mfaKeyConfigured()) throw mfaUnavailable()
      await assertPassword(user.passwordHash, request.body.currentPassword)
      if (user.mfaEnabledAt) throw ApiError.conflict('mfa_already_enabled', 'Two-step sign-in is already on for this account.')

      const secret = generateTotpSecret()
      await db
        .update(users)
        .set({ mfaSecret: sealSecret(secret), updatedAt: new Date() })
        .where(and(eq(users.id, user.id), isNull(users.mfaEnabledAt)))
      return { secret, otpauthUri: otpauthUri({ secret, account: user.email, issuer: MFA_ISSUER }) }
    },
  )

  app.post(
    '/auth/mfa/confirm',
    {
      config: strictLimit,
      schema: {
        tags: ['Account'],
        summary: 'Turn on two-step sign-in',
        description:
          'Checks a code from the authenticator app against the secret from setup. Returns ten one-time recovery codes — shown this once, stored only as digests. Every other signed-in device is signed out.',
        body: z.object({ code: codeSchema }),
        response: {
          200: z.object({ recoveryCodes: z.array(z.string()) }),
          400: problemSchema,
          401: problemSchema,
          403: problemSchema,
          409: problemSchema,
          429: problemSchema,
          503: problemSchema,
        },
      },
    },
    async (request, reply) => {
      const user = await currentUser(requireSession(request.session).userId)
      if (user.role !== 'admin') throw staffOnly()
      if (user.mfaEnabledAt) throw ApiError.conflict('mfa_already_enabled', 'Two-step sign-in is already on for this account.')
      if (!user.mfaSecret) throw ApiError.badRequest('Start setting up two-step sign-in first.')
      await checkSecondFactor(user, request.body.code, { allowRecovery: false })

      const recoveryCodes = generateRecoveryCodes()
      const [updated] = await db
        .update(users)
        .set({ mfaEnabledAt: new Date(), mfaRecoveryCodes: recoveryCodes.map(digestRecoveryCode), updatedAt: new Date() })
        .where(and(eq(users.id, user.id), isNull(users.mfaEnabledAt), eq(users.mfaSecret, user.mfaSecret)))
        .returning({ id: users.id })
      if (!updated) throw ApiError.conflict('mfa_already_enabled', 'Two-step sign-in was just changed elsewhere. Reload and try again.')

      // Sessions from before the second step existed do not get to keep skipping it.
      await destroyAllSessionsFor(user.id)
      reply.setCookie(SESSION_COOKIE, await createSession({ userId: user.id, email: user.email, role: user.role }), sessionCookieOptions(request.hostname))
      await notify(user, 'Two-step sign-in turned on', [
        'Signing in to your account now needs a code from your authenticator app as well as your password. Every other signed-in device was signed out.',
        'If this was not you, contact us immediately.',
      ])
      return { recoveryCodes }
    },
  )

  app.post(
    '/auth/mfa/disable',
    {
      config: strictLimit,
      schema: {
        tags: ['Account'],
        summary: 'Turn off two-step sign-in',
        description: 'Needs the current password and a current authenticator or recovery code.',
        body: z.object({ currentPassword: z.string().min(1).max(200), code: codeSchema }),
        response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema, 401: problemSchema, 429: problemSchema, 503: problemSchema },
      },
    },
    async (request) => {
      const user = await currentUser(requireSession(request.session).userId)
      if (!user.mfaEnabledAt) throw ApiError.badRequest('Two-step sign-in is not on for this account.')
      await assertPassword(user.passwordHash, request.body.currentPassword)
      await checkSecondFactor(user, request.body.code, { allowRecovery: true })
      await db
        .update(users)
        .set({ mfaSecret: null, mfaEnabledAt: null, mfaRecoveryCodes: [], updatedAt: new Date() })
        .where(eq(users.id, user.id))
      await notify(user, 'Two-step sign-in turned off', [
        'Signing in to your account now needs only your password again.',
        'If this was not you, change your password and contact us immediately.',
      ])
      return { ok: true as const }
    },
  )

  app.post(
    '/auth/login/mfa',
    {
      config: strictLimit,
      schema: {
        tags: ['Auth'],
        summary: 'Finish signing in with a second step',
        description:
          'After /auth/login answers `mfaRequired`, send its challenge token with a code from the authenticator app, or one of the recovery codes (each works once). A challenge lasts five minutes and allows five tries.',
        body: z.object({ challengeToken: z.string().min(20).max(100), code: codeSchema }),
        response: { 200: z.object({ user: publicUserSchema }), 400: problemSchema, 429: problemSchema, 503: problemSchema },
      },
    },
    async (request, reply) => {
      const { challengeToken, code } = request.body
      const userId = await readLoginChallenge(challengeToken)
      if (!userId || !(await spendChallengeAttempt(challengeToken))) throw challengeExpired()
      const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!user?.mfaEnabledAt) throw challengeExpired()

      await checkSecondFactor(user, code, { allowRecovery: true })
      // Two requests racing with good codes: only one gets the session.
      if (!(await consumeLoginChallenge(challengeToken))) throw challengeExpired()

      reply.setCookie(SESSION_COOKIE, await createSession({ userId: user.id, email: user.email, role: user.role }), sessionCookieOptions(request.hostname))
      return { user: toPublicUser(user) }
    },
  )
}
