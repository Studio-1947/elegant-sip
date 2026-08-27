import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://elegantsip:elegantsip@localhost:5432/elegantsip',
  },
  // Migrations are reviewed SQL, not silent pushes — see README.
  strict: true,
  verbose: true,
})
