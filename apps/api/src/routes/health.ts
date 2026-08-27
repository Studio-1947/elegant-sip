import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { healthResponseSchema, readyResponseSchema } from '@elegantsip/shared'
import { pingDatabase } from '../db/client.js'

const startedAt = Date.now()

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
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
        description: 'Reports 503 when a dependency is unreachable, so a load balancer stops sending traffic.',
        response: { 200: readyResponseSchema, 503: readyResponseSchema },
      },
    },
    async (_request, reply) => {
      const database = (await pingDatabase()) ? ('up' as const) : ('down' as const)
      const ready = database === 'up'
      return reply.status(ready ? 200 : 503).send({
        status: ready ? ('ready' as const) : ('degraded' as const),
        checks: { database },
      })
    },
  )
}
