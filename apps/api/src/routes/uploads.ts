import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { FastifyPluginAsync } from 'fastify'
import { STORED_NAME, productUploadsDir } from '../lib/uploads.js'

/**
 * Serves uploaded product photos at /uploads/products/<name>.webp.
 *
 * In production Caddy serves these straight from the shared volume and this
 * route is never reached; it exists for local development (Vite proxies
 * /uploads here) and tests. Only names the upload code itself generates are
 * accepted, so no path from the request ever reaches the file system unchecked.
 */
export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { name: string } }>(
    '/uploads/products/:name',
    { schema: { hide: true }, config: { rateLimit: false } },
    async (request, reply) => {
      const { name } = request.params
      if (!STORED_NAME.test(name)) return reply.code(404).send()
      const file = resolve(productUploadsDir(), name)
      try {
        await stat(file)
      } catch {
        return reply.code(404).send()
      }
      return reply
        .header('Content-Type', 'image/webp')
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(createReadStream(file))
    },
  )
}
