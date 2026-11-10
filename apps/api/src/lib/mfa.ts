import { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { ApiError } from './problem.js'
import { redis } from './sessions.js'
import { base32Decode, verifyTotp } from './totp.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Two-step sign-in for staff.
 *
 *  · The TOTP secret is stored encrypted (AES-256-GCM, MFA_ENCRYPTION_KEY), so
 *    a database dump alone cannot mint codes.
 *  · Recovery codes are stored as SHA-256 digests and removed as they are used.
 *    They are long random strings, so a fast hash is enough.
 *  · A password sign-in to such an account gets a short-lived challenge token
 *    in Redis instead of a session; only a correct second factor turns it into
 *    one. Wrong codes are capped per challenge and per account, on top of the
 *    per-address route limit, and an accepted code cannot be replayed.
 * ──────────────────────────────────────────────────────────────────────────── */

export const MFA_ISSUER = 'Elegant Sip'
export const RECOVERY_CODE_COUNT = 10

const CHALLENGE_TTL_SECONDS = 5 * 60
const MAX_ATTEMPTS_PER_CHALLENGE = 5
const MAX_FAILURES_PER_ACCOUNT = 10
const FAILURE_WINDOW_SECONDS = 15 * 60

/** Whether secrets can be encrypted, i.e. whether anyone can turn this on. */
export const mfaKeyConfigured = () => Boolean(env.MFA_ENCRYPTION_KEY)

export const mfaUnavailable = () =>
  new ApiError(
    503,
    'mfa_unavailable',
    'Two-step sign-in unavailable',
    'Two-step sign-in is not set up on this server yet. Ask whoever runs the server to set MFA_ENCRYPTION_KEY.',
  )

function key(): Buffer {
  if (!env.MFA_ENCRYPTION_KEY) throw mfaUnavailable()
  return Buffer.from(env.MFA_ENCRYPTION_KEY, 'hex')
}

/** `v1.<iv>.<tag>.<ciphertext>`, base64url. The version leaves room to rotate keys. */
export function sealSecret(secret: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const body = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), body].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.')
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, body] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unrecognised MFA secret format')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8')
}

/* ── Recovery codes ──────────────────────────────────────────────────────── */

// No 0/1/l/o, so a code read off paper cannot be mistyped into another one.
const RECOVERY_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Ten characters each (50 bits), shown as `abcde-fghij`. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const chars = Array.from({ length: 10 }, () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]).join('')
    return `${chars.slice(0, 5)}-${chars.slice(5)}`
  })
}

const normaliseRecoveryCode = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '')
export const digestRecoveryCode = (code: string) =>
  createHash('sha256').update(normaliseRecoveryCode(code)).digest('hex')

/** Removes the code in one conditional UPDATE, so it works exactly once even when raced. */
async function spendRecoveryCode(userId: string, code: string): Promise<boolean> {
  const digest = digestRecoveryCode(code)
  const rows = await db
    .update(users)
    .set({ mfaRecoveryCodes: sql`${users.mfaRecoveryCodes} - ${digest}::text`, updatedAt: new Date() })
    .where(and(eq(users.id, userId), sql`${users.mfaRecoveryCodes} @> jsonb_build_array(${digest}::text)`))
    .returning({ id: users.id })
  return rows.length > 0
}

/* ── Checking a code ─────────────────────────────────────────────────────── */

const failuresKey = (userId: string) => `mfa:failures:${userId}`

const tooManyFailures = () =>
  new ApiError(429, 'mfa_rate_limited', 'Too many attempts', 'Too many incorrect codes. Please wait 15 minutes and try again.')

const wrongCode = () =>
  ApiError.badRequest('That code is not right. Check that the time on your phone is correct and try again, or use a recovery code.')

/** Bumps a counter, starting its window on the first bump. */
async function bump(key: string, windowSeconds: number): Promise<number> {
  const count = await redis.incr(key)
  if (count === 1) await redis.expire(key, windowSeconds)
  return count
}

/** True the first time a step is used for this account; a replayed code is refused. */
async function claimStep(userId: string, counter: number): Promise<boolean> {
  // Kept past the ±1 step window, which is as long as a code stays valid.
  return (await redis.set(`mfa:step:${userId}:${counter}`, '1', 'EX', 120, 'NX')) === 'OK'
}

interface SecondFactorUser {
  id: string
  mfaSecret: string | null
}

async function matches(user: SecondFactorUser, code: string, allowRecovery: boolean): Promise<'totp' | 'recovery' | null> {
  if (/^\d{6}$/.test(code)) {
    if (!user.mfaSecret) return null
    // Without the key the secret cannot be read; recovery codes still work.
    if (!mfaKeyConfigured()) {
      throw new ApiError(
        503,
        'mfa_unavailable',
        'Authenticator codes unavailable',
        'Authenticator codes cannot be checked right now. Use one of your recovery codes instead.',
      )
    }
    const counter = verifyTotp(base32Decode(openSecret(user.mfaSecret)), code)
    return counter !== null && (await claimStep(user.id, counter)) ? 'totp' : null
  }
  if (allowRecovery && normaliseRecoveryCode(code).length === 10 && (await spendRecoveryCode(user.id, code))) return 'recovery'
  return null
}

/**
 * Checks a 6-digit authenticator code against `user.mfaSecret` (the confirmed
 * one, or the pending one during enrolment), or, when `allowRecovery`, spends a
 * recovery code. Throws a safe-to-show problem for anything but success.
 *
 * Like the WhatsApp codes, a guess is spent before it is checked (one atomic
 * INCR, so parallel guesses cannot outrun the cap) and handed back if right.
 */
export async function checkSecondFactor(
  user: SecondFactorUser,
  rawCode: string,
  { allowRecovery }: { allowRecovery: boolean },
): Promise<'totp' | 'recovery'> {
  const key = failuresKey(user.id)
  if ((await bump(key, FAILURE_WINDOW_SECONDS)) > MAX_FAILURES_PER_ACCOUNT) throw tooManyFailures()
  let result: 'totp' | 'recovery' | null
  try {
    result = await matches(user, rawCode.trim().replace(/\s/g, ''), allowRecovery)
  } catch (err) {
    // Not a wrong guess (the server could not check), so it does not count.
    await redis.decr(key)
    throw err
  }
  if (!result) throw wrongCode()
  await redis.decr(key)
  return result
}

/* ── Sign-in challenges ──────────────────────────────────────────────────── */

const challengeKey = (token: string) => `mfa:challenge:${createHash('sha256').update(token).digest('hex')}`

export const challengeExpired = () =>
  new ApiError(400, 'mfa_challenge_expired', 'Sign-in expired', 'That sign-in has expired. Enter your email and password again.')

/** Issued after a correct password; only its SHA-256 is stored, like a session. */
export async function createLoginChallenge(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await redis.set(challengeKey(token), JSON.stringify({ userId }), 'EX', CHALLENGE_TTL_SECONDS)
  return token
}

export async function readLoginChallenge(token: string): Promise<string | null> {
  const raw = await redis.get(challengeKey(token))
  if (!raw) return null
  try {
    return (JSON.parse(raw) as { userId: string }).userId
  } catch {
    return null
  }
}

/**
 * Spends one of this challenge's five guesses; false once they are gone, and
 * the challenge with them, so the password has to be entered again.
 */
export async function spendChallengeAttempt(token: string): Promise<boolean> {
  const hash = challengeKey(token)
  if ((await bump(`${hash}:attempts`, CHALLENGE_TTL_SECONDS)) <= MAX_ATTEMPTS_PER_CHALLENGE) return true
  await redis.del(hash)
  return false
}

/** Single use: true only for the request that actually removed it. */
export async function consumeLoginChallenge(token: string): Promise<boolean> {
  return (await redis.del(challengeKey(token))) === 1
}
