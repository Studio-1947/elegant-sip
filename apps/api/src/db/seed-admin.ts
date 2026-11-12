import { hash, verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { env } from '../env.js'
import { destroyAllSessionsFor } from '../lib/sessions.js'
import { ARGON2, emailSchema, passwordSchema } from '../routes/auth-shared.js'
import { db } from './client.js'
import { users } from './schema-commerce.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Staff account from ADMIN_EMAIL / ADMIN_PASSWORD, applied on every boot.
 *
 * While both are set, .env is the source of truth for this one account:
 *  · missing  → created as a verified admin
 *  · present  → made admin if it was not, and its password reset to
 *               ADMIN_PASSWORD if it differs (ending its existing sessions)
 * Blank them to manage the account from the site instead. Removing them never
 * demotes anyone; that stays a deliberate database change.
 *
 * Bad values are logged and skipped, never fatal: a shop that will not start
 * over an admin typo is worse than one missing an admin until it is fixed.
 * ──────────────────────────────────────────────────────────────────────────── */

type Log = { info: (msg: string) => void; error: (msg: string) => void }

export type AdminSeedResult = 'skipped' | 'invalid' | 'created' | 'updated' | 'unchanged'

export async function seedAdmin(
  config: Pick<typeof env, 'ADMIN_EMAIL' | 'ADMIN_PASSWORD' | 'ADMIN_NAME'> = env,
  log: Log = console,
): Promise<AdminSeedResult> {
  if (!config.ADMIN_EMAIL && !config.ADMIN_PASSWORD) return 'skipped'

  const email = emailSchema.safeParse(config.ADMIN_EMAIL ?? '')
  const password = passwordSchema.safeParse(config.ADMIN_PASSWORD ?? '')
  if (!email.success || !password.success) {
    const problems = [
      !email.success && 'ADMIN_EMAIL must be a valid email address',
      !password.success && 'ADMIN_PASSWORD must be at least 10 characters',
    ].filter(Boolean)
    log.error(`admin account not seeded: ${problems.join('; ')}`)
    return 'invalid'
  }

  const name = config.ADMIN_NAME?.trim() || 'Shop admin'
  const existing = await db.query.users.findFirst({ where: eq(users.email, email.data) })

  if (!existing) {
    await db.insert(users).values({
      email: email.data,
      name,
      passwordHash: await hash(password.data, ARGON2),
      role: 'admin',
      emailVerifiedAt: new Date(),
    })
    log.info(`admin account created for ${email.data}`)
    return 'created'
  }

  let passwordMatches: boolean
  try {
    passwordMatches = await verify(existing.passwordHash, password.data)
  } catch {
    passwordMatches = false
  }
  if (existing.role === 'admin' && passwordMatches) return 'unchanged'

  await db
    .update(users)
    .set({
      role: 'admin',
      emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      ...(passwordMatches ? {} : { passwordHash: await hash(password.data, ARGON2) }),
      updatedAt: new Date(),
    })
    .where(eq(users.id, existing.id))
  // Same rule as a password change on the site: old sessions do not survive it.
  if (!passwordMatches) await destroyAllSessionsFor(existing.id)

  const changes = [existing.role !== 'admin' && 'promoted to admin', !passwordMatches && 'password reset from ADMIN_PASSWORD']
  log.info(`admin account ${email.data}: ${changes.filter(Boolean).join(', ')}`)
  return 'updated'
}
