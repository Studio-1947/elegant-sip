import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { healthResponseSchema, readyResponseSchema } from '@elegantsip/shared'
import { pingDatabase } from '../db/client.js'
import { paymentsEnabled } from '../env.js'
import { pingRedis } from '../lib/sessions.js'
import { getStoreSettings } from '../lib/settings.js'

const startedAt = Date.now()

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/storefront-status',
    {
      schema: {
        tags: ['Health'],
        summary: 'Public storefront capability status',
        description:
          'What the storefront may offer right now: online payment, guest checkout and the satisfaction guarantee. Never fails on a settings read; it falls back to the defaults (no guest checkout, a 30-day guarantee).',
        response: {
          200: z.object({
            paymentsAvailable: z.boolean(),
            guestCheckout: z.boolean(),
            guarantee: z.object({ enabled: z.boolean(), days: z.number().int() }),
          }),
        },
      },
    },
    async () => {
      // Cached and never throws, so this stays as cheap as the payment flag.
      const settings = await getStoreSettings()
      return {
        paymentsAvailable: paymentsEnabled,
        guestCheckout: settings.guestCheckoutEnabled,
        guarantee: { enabled: settings.guaranteeEnabled, days: settings.guaranteeDays },
      }
    },
  )
  /*
   * Liveness: is the process up? Deliberately checks NO dependencies — if the
   * database is down the container should keep running and serve errors, not
   * be killed and restarted in a loop.
   */
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Liveness probe',
        description: 'Process is running. Checks no dependencies by design.',
        response: { 200: healthResponseSchema },
      },
    },
    async () => ({
      status: 'ok' as const,
      uptime: Math.round((Date.now() - startedAt) / 1000),
      version: process.env.npm_package_version ?? '0.1.0',
    }),
  )

  /* Readiness: should this instance receive traffic? Checks dependencies. */
  app.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness probe',
        description:
          'Checks PostgreSQL and Redis, reporting each. 503 when either is unreachable, so a load balancer stops sending traffic.',
        response: { 200: readyResponseSchema, 503: readyResponseSchema },
      },
    },
    async (_request, reply) => {
      // Redis holds every session: without it nobody can sign in or check out.
      const [dbUp, redisUp] = await Promise.all([pingDatabase(), pingRedis()])
      const state = (up: boolean) => (up ? ('up' as const) : ('down' as const))
      const ready = dbUp && redisUp
      return reply.status(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('degraded' as const),
        checks: { database: state(dbUp), redis: state(redisUp) },
      })
    },
  )
}
