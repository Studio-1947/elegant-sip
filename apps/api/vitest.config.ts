import { defineConfig } from 'vitest/config'

/*
 * Test defaults so `npm test` works from the repo root without every developer
 * exporting the same four variables. env.ts deliberately exits on missing
 * config, which is right in production and unhelpful in a test runner.
 *
 * These point at the docker-compose stack. When it is not running, the suite
 * detects the missing database and skips rather than failing.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts'],
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://elegantsip:elegantsip@localhost:5432/elegantsip',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      LOG_LEVEL: 'silent',
      PAYMENT_PROVIDER: 'fake',
      NODE_ENV: 'test',
    },
    // The checkout suite shares one database; parallel files would fight over
    // the same stock rows.
    fileParallelism: false,
  },
})
