import { randomBytes } from 'node:crypto'
import { hash } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { OAuth2Client } from 'google-auth-library'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { claimGuestOrders } from '../lib/guest-orders.js'
import { ApiError } from '../lib/problem.js'
import { SESSION_COOKIE, createSession, destroyAllSessionsFor, sessionCookieOptions } from '../lib/sessions.js'
import { ARGON2, PLACEHOLDER_NAME, publicUserSchema, strictLimit, toPublicUser } from './auth-shared.js'

/* ────────────────────────────────────────────────────────────────────────────
 * "Continue with Google".
 *
 * The storefront shows Google's own button (Google Identity Services), which
 * hands it a signed ID token. That token is checked here with Google's library:
 * its signature, that it was issued for GOOGLE_CLIENT_ID, and that it has not
 * expired. Only an address Google has verified is accepted.
 *
 * The person is then signed in to the account with that email, or a new one is
 * made, and gets the same session cookie as every other sign-in. Off until
 * GOOGLE_CLIENT_ID is set.
 *
 *  · An existing account whose email was never confirmed may have been
 *    registered by someone else with a password they know. Google proves this
 *    person owns the address, so that password is replaced with a random one
 *    and its sessions are ended before signing them in: the address's real
 *    owner gets the account, and whoever registered it does not.
 *  · Accounts with two-step sign-in are refused, as with WhatsApp: Google must
 *    not be a way round the authenticator app.
 *  · Guest orders placed with the address become this account's, as when an
 *    email is confirmed.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GoogleIdentity {
  email: string
  name: string
}

/** Checks the ID token with Google. Null for any token that is not good for this site. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity | null>

let client: OAuth2Client | null = null

export const verifyWithGoogle: GoogleVerifier = async (idToken) => {
  const clientId = env.GOOGLE_CLIENT_ID
  if (!clientId) return null
  client ??= new OAuth2Client(clientId)
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId })
    const p = ticket.getPayload()
    if (!p?.email || p.email_verified !== true) return null
    return { email: p.email.trim().toLowerCase(), name: (p.name ?? '').trim().slice(0, 100) }
  } catch {
    return null
  }
}

export const googleAuthAvailable = () => Boolean(env.GOOGLE_CLIENT_ID)

export const googleAuthRoutes: FastifyPluginAsyncZod<{ verify?: GoogleVerifier }> = async (app, opts) => {
  const verify = opts.verify ?? verifyWithGoogle

  app.post(
    '/auth/google',
    {
      config: strictLimit,
      schema: {
        tags: ['Auth'],
        summary: 'Sign in with Google',
        description:
          'Takes the ID token from Google Identity Services. Signs in to the account with that verified email, or creates one. 404 while Google sign-in is not configured.',
        body: z.object({ credential: z.string().min(20).max(4096) }),
        response: { 200: z.object({ user: publicUserSchema }), 401: problemSchema, 403: problemSchema, 404: problemSchema },
      },
    },
    async (request, reply) => {
      if (!googleAuthAvailable()) throw new ApiError(404, 'google_unavailable', 'Not available', 'Google sign-in is not available.')

      const identity = await verify(request.body.credential)
      if (!identity) {
        throw new ApiError(401, 'google_failed', 'Google sign-in failed', 'Google could not confirm who you are. Please try again.')
      }

      const existing = await db.query.users.findFirst({ where: eq(users.email, identity.email) })
      if (existing?.mfaEnabledAt) {
        throw new ApiError(403, 'mfa_required', 'Use email sign-in', 'This account uses two-step sign-in. Sign in with your email, password and authenticator code instead.')
      }

      const takeover = Boolean(existing && !existing.emailVerifiedAt)
      const user = await db.transaction(async (tx) => {
        let row = existing
        if (!row) {
          ;[row] = await tx
            .insert(users)
            .values({
              email: identity.email,
              name: identity.name || PLACEHOLDER_NAME,
              // No password: they sign in with Google, or set one with "Forgot password".
              passwordHash: await hash(randomBytes(32).toString('base64url'), ARGON2),
              emailVerifiedAt: new Date(),
            })
            .returning()
        } else if (takeover) {
          ;[row] = await tx
            .update(users)
            .set({
              emailVerifiedAt: new Date(),
              passwordHash: await hash(randomBytes(32).toString('base64url'), ARGON2),
              updatedAt: new Date(),
            })
            .where(eq(users.id, row.id))
            .returning()
        }
        // Ownership of the address is proven, so its guest orders are this account's.
        await claimGuestOrders(tx, row!.id, row!.email)
        return row!
      })

      if (takeover) await destroyAllSessionsFor(user.id)

      const token = await createSession({ userId: user.id, email: user.email, role: user.role })
      reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(request.hostname))
      return { user: toPublicUser(user) }
    },
  )
}
