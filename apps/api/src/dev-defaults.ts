/*
 * Local defaults matching docker-compose, applied by being imported BEFORE
 * env.ts. ES module imports are hoisted above statements, so assigning these
 * inline in a script would run too late — they have to live in a module that
 * appears first in the import list.
 *
 * Anything already set in the environment wins, so this changes nothing in CI
 * or production.
 */
process.env.DATABASE_URL ??= 'postgres://elegantsip:elegantsip@localhost:5432/elegantsip'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.SMTP_URL ??= 'smtp://localhost:1025'
process.env.SITE_URL ??= 'http://localhost:5173'
process.env.LOG_LEVEL ??= 'silent'
