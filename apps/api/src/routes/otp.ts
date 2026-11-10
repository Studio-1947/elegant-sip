import { randomBytes, randomInt } from 'node:crypto'
import { hash, verify } from '@node-rs/argon2'
import { and, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { indianMobileError, normaliseIndianMobile, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { otpChallenges, users } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { ApiError } from '../lib/problem.js'
import { SESSION_COOKIE, createSession, sessionCookieOptions } from '../lib/sessions.js'
import { ARGON2, isPlaceholderEmail, limit, ownEmailSchema, passwordSchema, PLACEHOLDER_EMAIL_DOMAIN, PLACEHOLDER_NAME, publicUserSchema, sendVerificationEmail, toPublicUser } from './auth-shared.js'
import { revokeEmailVerifications } from './profile.js'

/* ────────────────────────────────────────────────────────────────────────────
 * The per-IP limits on these routes stop one machine, not one attacker: many
 * addresses could share the guesses against a single number, and anyone could
 * make the shop pay to message a stranger. So each number also carries its own
 * budget, kept in otp_challenges itself (no extra infrastructure):
 *
 *   · codes sent:     3 per 10 minutes and 10 per 24 hours, across purposes;
 *   · wrong guesses:  5 per code, and 10 per 24 hours across all its codes.
 *
 * `attempts` counts wrong guesses only. A guess is spent before the hash is
 * checked (one conditional UPDATE, so parallel guesses cannot outrun the cap)
 * and handed back when it turns out to be right.
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_ATTEMPTS_PER_CODE = 5
const MAX_CODES_PER_10_MIN = 3
const MAX_CODES_PER_DAY = 10
const MAX_FAILURES_PER_DAY = 10
const CODE_TTL_MS = 10 * 60_000
/* Per address, on top of the per-number budget. Generous because Indian mobile
   carriers put many customers behind one carrier-grade NAT address. */
const IP_CODE_REQUESTS = 20

const phoneSchema = z.string().trim().max(20)
const codeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code.')
const response = z.object({ ok: z.literal(true), challengeId: z.string().uuid().optional() })
/** Same rule as the storefront form, so the browser and the API never disagree. */
const normalisePhone = (input: string) => {
  const local = normaliseIndianMobile(input)
  if (!local) throw ApiError.badRequest(indianMobileError(input) ?? 'Enter a valid Indian WhatsApp number.')
  return `+91${local}`
}

const invalidCode = () => ApiError.badRequest('That code is invalid or has expired. Request a new one.')
const rateLimited = (detail: string) => new ApiError(429, 'otp_rate_limited', 'Too many requests', detail)
const TOO_MANY_RECENT = 'Too many codes requested for this number. Please wait a few minutes and try again.'
const TOO_MANY_TODAY =
  'Too many codes requested for this number today. Please try again tomorrow, or sign in with email and password.'
const TOO_MANY_FAILURES =
  'Too many incorrect codes for this number. Please try again tomorrow, or sign in with email and password.'

/** True only when a code can actually be delivered. */
const otpAvailable = () => env.AUTH_OTP_PROVIDER === 'interakt' && Boolean(env.INTERAKT_API_KEY)
const otpUnavailable = () =>
  new ApiError(503, 'otp_unavailable', 'WhatsApp sign-in unavailable', 'WhatsApp sign-in is being prepared. Please use email and password for now.')

/** This number's codes from the last 24 hours, as a Drizzle condition. */
const sentToday = (phone: string) =>
  and(eq(otpChallenges.phone, phone), gt(otpChallenges.createdAt, sql`now() - interval '24 hours'`))

async function sendOtp(phone: string, code: string, challengeId: string) {
  if (!otpAvailable()) throw otpUnavailable()
  const unavailable = () =>
    new ApiError(503, 'otp_delivery_failed', 'WhatsApp sign-in unavailable', 'We could not send a WhatsApp code. Please try again shortly.')
  const result = await fetch(`${env.INTERAKT_API_BASE_URL.replace(/\/$/, '')}/message/`, {
    method: 'POST',
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Basic ${env.INTERAKT_API_KEY}`, 'Content-Type': 'application/json' },
    // Interakt authentication templates require the exact same code in the
    // body and Copy Code / one-tap button value.
    body: JSON.stringify({ countryCode: '+91', phoneNumber: phone.slice(3), type: 'Template', callbackData: `otp:${challengeId}`, template: { name: env.INTERAKT_OTP_TEMPLATE, languageCode: env.INTERAKT_OTP_TEMPLATE_LANGUAGE, bodyValues: [code], buttonValues: { '0': [code] } } }),
  }).catch((err: unknown) => {
    // Timeout or network failure. Only the error name is logged, never the request.
    console.warn(`[interakt] OTP template request did not complete (${err instanceof Error ? err.name : 'unknown error'})`)
    throw unavailable()
  })
  if (!result.ok) {
    // No response body, API key, phone number, or OTP is ever logged.
    console.warn(`[interakt] OTP template request rejected (status=${result.status}, template=${env.INTERAKT_OTP_TEMPLATE})`)
    throw unavailable()
  }
}

async function issue(userId: string | null, phone: string, purpose: 'phone_login' | 'phone_link') {
  // Before touching the database, so a disabled provider never spends a budget.
  if (!otpAvailable()) throw otpUnavailable()
  const code = String(randomInt(100000, 1_000_000))
  const codeHash = await hash(code, ARGON2)
  const id = await db.transaction(async (tx) => {
    // Serialises requests for one number, so simultaneous requests cannot all
    // read the same count and each slip under the cap.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`)
    const [usage] = await tx
      .select({
        recent: sql<number>`count(*) filter (where ${otpChallenges.createdAt} > now() - interval '10 minutes')::int`,
        daily: sql<number>`count(*)::int`,
        failures: sql<number>`coalesce(sum(${otpChallenges.attempts}), 0)::int`,
      })
      .from(otpChallenges)
      .where(sentToday(phone))
    if (usage.failures >= MAX_FAILURES_PER_DAY) throw rateLimited(TOO_MANY_FAILURES)
    if (usage.daily >= MAX_CODES_PER_DAY) throw rateLimited(TOO_MANY_TODAY)
    if (usage.recent >= MAX_CODES_PER_10_MIN) throw rateLimited(TOO_MANY_RECENT)
    // Only the newest code for a number and purpose is ever valid.
    await tx
      .update(otpChallenges)
      .set({ expiresAt: sql`now()` })
      .where(
        and(
          eq(otpChallenges.phone, phone),
          eq(otpChallenges.purpose, purpose),
          isNull(otpChallenges.consumedAt),
          gt(otpChallenges.expiresAt, sql`now()`),
        ),
      )
    const [challenge] = await tx
      .insert(otpChallenges)
      .values({ userId, phone, purpose, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MS) })
      .returning({ id: otpChallenges.id })
    return challenge.id
  })
  // Outside the transaction: a slow provider must not hold the lock. A code
  // that fails to send still counts, so retries cannot hammer the provider.
  await sendOtp(phone, code, id)
  return id
}

async function consume(id: string, code: string, purpose: 'phone_login' | 'phone_link', userId?: string) {
  // Spend a guess first, atomically. Zero rows — unknown, used, expired,
  // locked, or another account's challenge — all get the same answer.
  const [row] = await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(
      and(
        eq(otpChallenges.id, id),
        eq(otpChallenges.purpose, purpose),
        isNull(otpChallenges.consumedAt),
        gt(otpChallenges.expiresAt, sql`now()`),
        lt(otpChallenges.attempts, MAX_ATTEMPTS_PER_CODE),
        ...(userId ? [eq(otpChallenges.userId, userId)] : []),
      ),
    )
    .returning()
  if (!row) throw invalidCode()
  // Read after our own increment committed, so however many guesses run in
  // parallel, at most the budget's worth can see a total within it.
  const [{ failures }] = await db
    .select({ failures: sql<number>`coalesce(sum(${otpChallenges.attempts}), 0)::int` })
    .from(otpChallenges)
    .where(sentToday(row.phone))
  if (failures > MAX_FAILURES_PER_DAY) throw rateLimited(TOO_MANY_FAILURES)
  if (!(await verify(row.codeHash, code))) throw invalidCode()
  // Right code: hand the guess back, so `attempts` only ever counts failures,
  // and consume it. Zero rows means a parallel request already used it; the
  // guess is still returned, as it was not a wrong one.
  const handBack = sql`greatest(${otpChallenges.attempts} - 1, 0)`
  const [done] = await db
    .update(otpChallenges)
    .set({ consumedAt: sql`now()`, attempts: handBack })
    .where(and(eq(otpChallenges.id, row.id), isNull(otpChallenges.consumedAt)))
    .returning()
  if (!done) {
    await db.update(otpChallenges).set({ attempts: handBack }).where(eq(otpChallenges.id, row.id))
    throw invalidCode()
  }
  return done
}

export const otpRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/auth/methods', { schema: { tags: ['Auth'], summary: 'Sign-in methods currently available', response: { 200: z.object({ whatsapp: z.boolean() }) } } }, async (_request, reply) => {
    // Configuration only changes on deploy; a minute of caching is harmless.
    reply.header('Cache-Control', 'public, max-age=60')
    return { whatsapp: otpAvailable() }
  })
  app.post('/auth/whatsapp/request', { config: limit(IP_CODE_REQUESTS, '10 minutes'), schema: { tags: ['Auth'], body: z.object({ phone: phoneSchema }), response: { 200: response } } }, async (request) => {
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
        name: PLACEHOLDER_NAME,
        // Email remains an internal required column for legacy password flows.
        // This reserved domain is never mailed and is not shown as a contact address.
        email: `whatsapp-${local}${PLACEHOLDER_EMAIL_DOMAIN}`,
        passwordHash: await hash(randomBytes(32).toString('base64url'), ARGON2),
        phone: challenge.phone,
        phoneVerifiedAt: new Date(),
      }).returning()
      user = created
    }
    if (!user) throw invalidCode()
    /* A WhatsApp code must not be a way round the authenticator app. Refusing
       is simpler and as safe as chaining a second step onto WhatsApp sign-in;
       staff with two-step sign-in use email and password. */
    if (user.mfaEnabledAt) {
      throw new ApiError(403, 'mfa_required', 'Use email sign-in', 'This account uses two-step sign-in. Sign in with your email, password and authenticator code instead.')
    }
    reply.setCookie(SESSION_COOKIE, await createSession({ userId: user.id, email: user.email, role: user.role }), sessionCookieOptions(request.hostname))
    return { user: toPublicUser(user) }
  })
  app.post('/account/whatsapp/request', { config: limit(IP_CODE_REQUESTS, '10 minutes'), schema: { tags: ['Account'], body: z.object({ phone: phoneSchema }), response: { 200: response } } }, async (request) => {
    if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    const phone = normalisePhone(request.body.phone)
    // No "already linked" check here: answering it before the code is proven
    // would let any signed-in user test which numbers belong to other accounts.
    return { ok: true as const, challengeId: await issue(request.session.userId, phone, 'phone_link') }
  })
  app.post('/account/whatsapp/verify', { config: limit(10, '10 minutes'), schema: { tags: ['Account'], body: z.object({ challengeId: z.string().uuid(), code: codeSchema }), response: { 200: response } } }, async (request) => {
    if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    const challenge = await consume(request.body.challengeId, request.body.code, 'phone_link', request.session.userId)
    // Only now, with control of the phone proven, is it safe to say who has it.
    const existing = await db.query.users.findFirst({ where: eq(users.phone, challenge.phone) })
    if (existing && existing.id !== request.session.userId) throw ApiError.conflict('phone_in_use', 'That WhatsApp number is already linked to another account.')
    await db.update(users).set({ phone: challenge.phone, phoneVerifiedAt: new Date(), updatedAt: new Date() }).where(eq(users.id, request.session.userId))
    return { ok: true as const }
  })

  /*
   * WhatsApp-only accounts (stand-in email, a password nobody knows) adding
   * their first real email and password. The session alone is not enough —
   * these become the credentials for password resets — so a fresh code to the
   * account's own verified number is required too. It reuses the `phone_link`
   * purpose, which already means "this signed-in account proves this phone",
   * rather than adding an enum value (a migration): the challenge is bound to
   * the account by `consume`, and the number must be the one on the account.
   */
  app.post('/account/credentials/request', { config: limit(IP_CODE_REQUESTS, '10 minutes'), schema: { tags: ['Account'], summary: 'Send a WhatsApp code before adding an email and password', response: { 200: response, 400: problemSchema, 401: problemSchema, 409: problemSchema, 429: problemSchema, 503: problemSchema } } }, async (request) => {
    const user = await whatsappOnlyUser(request.session)
    return { ok: true as const, challengeId: await issue(user.id, user.phone, 'phone_link') }
  })
  app.post('/account/credentials', { config: limit(10, '10 minutes'), schema: { tags: ['Account'], summary: 'Add an email and password to a WhatsApp-only account', description: 'Needs the code from /account/credentials/request. The address starts unconfirmed and is sent a confirmation link; `delivered` says whether that email went out.', body: z.object({ challengeId: z.string().uuid(), code: codeSchema, email: ownEmailSchema, password: passwordSchema }), response: { 200: z.object({ user: publicUserSchema, delivered: z.boolean() }), 400: problemSchema, 401: problemSchema, 409: problemSchema, 429: problemSchema } } }, async (request) => {
    const user = await whatsappOnlyUser(request.session)
    const challenge = await consume(request.body.challengeId, request.body.code, 'phone_link', user.id)
    if (challenge.phone !== user.phone) throw invalidCode()
    // Only after the code, as on the email-change route: the caller has proved who they are.
    const taken = await db.query.users.findFirst({ where: eq(users.email, request.body.email) })
    if (taken) throw ApiError.conflict('email_taken', 'That email address is already in use on another account.')
    const passwordHash = await hash(request.body.password, ARGON2)
    // Conditional on the stand-in still being there, so two racing requests cannot both set credentials.
    const [updated] = await db
      .update(users)
      .set({ email: request.body.email, emailVerifiedAt: null, passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.email, user.email)))
      .returning()
    if (!updated) throw ApiError.conflict('credentials_exist', 'This account already has an email address. Reload the page to see it.')
    await revokeEmailVerifications(user.id)
    const { delivered } = await sendVerificationEmail({ id: updated.id, email: updated.email, name: updated.name })
    return { user: toPublicUser(updated), delivered }
  })
}

/** The signed-in account, if it is still WhatsApp-only and has a verified number to send to. */
async function whatsappOnlyUser(session: { userId: string } | null) {
  if (!session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
  const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
  if (!user) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in again to continue.')
  if (!isPlaceholderEmail(user.email)) {
    throw ApiError.conflict('credentials_exist', 'This account already has an email address. Change it from your account settings instead.')
  }
  if (!user.phone || !user.phoneVerifiedAt) throw ApiError.badRequest('This account has no verified WhatsApp number to send a code to.')
  return { ...user, phone: user.phone }
}
