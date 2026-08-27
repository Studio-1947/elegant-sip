import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env, isProduction } from '../env.js'
import * as schema from './index.js'

/*
 * One pool for the process. `max: 10` suits a single small instance; raise it
 * only alongside the database's own connection limit.
 */
export const sql = postgres(env.DATABASE_URL, {
  max: isProduction ? 10 : 4,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
})

export const db = drizzle(sql, { schema })

export type Db = typeof db

/** Cheap liveness probe for the readiness endpoint. */
export async function pingDatabase(): Promise<boolean> {
  try {
    await sql`SELECT 1`
    return true
  } catch {
    return false
  }
}
