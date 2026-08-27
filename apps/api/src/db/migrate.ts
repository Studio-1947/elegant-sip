import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { db, sql } from './client.js'

/*
 * Run explicitly (`npm run db:migrate`), never on server boot: two instances
 * starting at once would race each other through the migration table.
 */
await migrate(db, { migrationsFolder: './drizzle' })
console.log('migrations applied')
await sql.end()
