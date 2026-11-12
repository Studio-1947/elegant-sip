import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verify } from '@node-rs/argon2'
import { eq } from 'drizzle-orm'
import { db, sql } from './client.js'
import { users } from './schema-commerce.js'
import { redis } from '../lib/sessions.js'
import { seedAdmin } from './seed-admin.js'

/* The .env staff account, against the dev database. */

const EMAIL = `seed-admin.${Date.now()}@example.test`
const silent = { info: () => {}, error: () => {} }
const row = () => db.query.users.findFirst({ where: eq(users.email, EMAIL) })

let available = true

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
  }
})

afterAll(async () => {
  if (available) await db.delete(users).where(eq(users.email, EMAIL))
  await sql.end()
  redis.disconnect()
})

describe('seedAdmin', () => {
  it('does nothing when unset', async () => {
    expect(await seedAdmin({}, silent)).toBe('skipped')
  })

  it('skips, without throwing, on a bad email or a short password', async () => {
    expect(await seedAdmin({ ADMIN_EMAIL: 'admin2', ADMIN_PASSWORD: 'long-enough-password' }, silent)).toBe('invalid')
    expect(await seedAdmin({ ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: 'admin@123' }, silent)).toBe('invalid')
  })

  it('creates, leaves alone, re-promotes and resets the password', async ({ skip }) => {
    if (!available) skip()
    const config = { ADMIN_EMAIL: EMAIL, ADMIN_PASSWORD: 'first-long-password' }

    expect(await seedAdmin(config, silent)).toBe('created')
    let user = await row()
    expect(user?.role).toBe('admin')
    expect(user?.emailVerifiedAt).not.toBeNull()

    expect(await seedAdmin(config, silent)).toBe('unchanged')

    await db.update(users).set({ role: 'customer' }).where(eq(users.email, EMAIL))
    expect(await seedAdmin({ ...config, ADMIN_PASSWORD: 'second-long-password' }, silent)).toBe('updated')
    user = await row()
    expect(user?.role).toBe('admin')
    expect(await verify(user!.passwordHash, 'second-long-password')).toBe(true)
  })
})
