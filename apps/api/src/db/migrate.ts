import { argv } from 'node:process'
import { pathToFileURL } from 'node:url'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from './client.js'

/*
 * Normally run as its own step before the new version starts, so that two
 * instances booting together cannot race each other through the migration
 * table.
 *
 * Exported as a function because some hosts have no pre-deploy step on their
 * free tier; those set MIGRATE_ON_START and the server calls this during boot
 * instead. That is only safe there because such tiers run a single instance —
 * see the comment on MIGRATE_ON_START in env.ts.
 */
export async function runMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder: './drizzle' })
}

/* Only when executed directly, so importing this does not end the shared pool. */
if (import.meta.url === pathToFileURL(argv[1] ?? '').href) {
  await runMigrations()
  console.log('migrations applied')
  await sql.end()
}
