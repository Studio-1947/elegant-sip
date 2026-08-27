import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/client.js'
import { authTokens } from '../db/schema-commerce.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Shared by the two halves of identity: auth.ts, which is about getting in
 * (register, sign in, forgotten passwords), and profile.ts, which is about
 * managing the account once you are. They are split because both were pushing
 * one file past the size this codebase keeps to, and because the halves have
 * genuinely different rules — everything in auth.ts is reachable by a stranger,
 * nothing in profile.ts is.
 *
 * The password hashing parameters, token handling and public shape of a user
 * live here so the two can never disagree about them.
 * ──────────────────────────────────────────────────────────────────────────── */

// OWASP-recommended baseline for interactive logins.
export const ARGON2 = { memoryCost: 19456, timeCost: 2, parallelism: 1 }

/**
 * Endpoints where guessing is worth an attacker's time carry a much tighter
 * limit than the global one.
 *
 * Empty under test: the suite drives dozens of sign-ins from a single address
 * within seconds, which is indistinguishable from an attack, and would make
 * unrelated tests fail according to how many ran before them. The limiter is a
 * production behaviour and is exercised against a running server instead.
 */
const UNDER_TEST = process.env.NODE_ENV === 'test'

/** A limit high enough that only a real attack reaches it. */
export const limit = (max: number, timeWindow: string) => ({
  rateLimit: { max: UNDER_TEST ? 1_000_000 : max, timeWindow },
})

export const strictLimit = limit(10, '1 minute')

export const emailSchema = z.string().trim().toLowerCase().email().max(254)

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(200)
  .describe('Minimum 10 characters. Length beats complexity rules.')

export const publicUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  name: z.string(),
  role: z.enum(['customer', 'admin']),
  emailVerified: z.boolean(),
})

/** The only shape of a user that ever leaves the server. */
export function toPublicUser(user: {
  id: string
  email: string
  name: string
  role: 'customer' | 'admin'
  emailVerifiedAt: Date | null
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
  }
}

export type TokenPurpose = 'email_verification' | 'password_reset'

const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000,
  password_reset: 60 * 60 * 1000,
}

/** Stores only a hash — a database dump must not yield working links. */
export async function issueToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.insert(authTokens).values({
    userId,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    purpose,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
  })
  return token
}

export async function consumeToken(token: string, purpose: TokenPurpose): Promise<string | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const row = await db.query.authTokens.findFirst({
    where: and(
      eq(authTokens.tokenHash, tokenHash),
      eq(authTokens.purpose, purpose),
      isNull(authTokens.consumedAt),
    ),
  })
  if (!row || row.expiresAt.getTime() < Date.now()) return null
  await db.update(authTokens).set({ consumedAt: new Date() }).where(eq(authTokens.id, row.id))
  return row.userId
}

/**
 * Sent on registration, on request, and to a new address when one is set.
 * `sendEmail` reports an undelivered message rather than throwing, so a mail
 * outage never costs someone their account — it costs them a link they can ask
 * for again.
 */
export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, 'email_verification')
  return sendEmail({
    to: user.email,
    subject: 'Confirm your Elegant Sip account',
    heading: 'One tap to confirm',
    body: [
      `Welcome, ${user.name}.`,
      'Confirm this address and your account is ready. The link is good for 24 hours.',
    ],
    action: { label: 'Confirm my email', url: `${env.SITE_URL}/verify-email?token=${token}` },
  })
}
