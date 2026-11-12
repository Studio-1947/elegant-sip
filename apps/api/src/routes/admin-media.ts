import { and, eq, isNotNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orderItems } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { MAX_UPLOAD_BYTES, NotAnImageError, UPLOAD_TYPES, saveProductPhoto } from '../lib/uploads.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — photos and removing packs. Registered inside the admin plugin, so the
 * staff-only hook covers every route here.
 * ──────────────────────────────────────────────────────────────────────────── */

export const adminMediaRoutes: FastifyPluginAsyncZod = async (app) => {
  // Photos arrive as the raw file body (Content-Type: image/jpeg etc.). Scoped
  // to this plugin, so no other route accepts binary bodies.
  app.addContentTypeParser([...UPLOAD_TYPES], { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES }, (_req, body, done) =>
    done(null, body),
  )

  app.post(
    '/admin/uploads/product-photo',
    {
      bodyLimit: MAX_UPLOAD_BYTES,
      schema: {
        tags: ['Admin'],
        summary: 'Upload a product photo',
        description: [
          'Send the photo itself as the request body with its Content-Type (JPG, PNG, WebP or AVIF, up to 15 MB).',
          'It is re-encoded to WebP (max 2048px, plus 640px and 1024px sizes) and the returned `src` can be used',
          'as a product\'s main photo or in its gallery. Uploading does not change any product by itself.',
        ].join('\n'),
        response: {
          200: z.object({ src: z.string(), width: z.number().int(), height: z.number().int() }),
          400: problemSchema,
          413: problemSchema,
          415: problemSchema,
        },
      },
    },
    async (request) => {
      const body = request.body
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw ApiError.badRequest('Send a JPG, PNG, WebP or AVIF photo as the request body.')
      }
      try {
        return await saveProductPhoto(body)
      } catch (error) {
        if (error instanceof NotAnImageError) throw ApiError.badRequest(error.message)
        throw error
      }
    },
  )

  app.delete(
    '/admin/products/:slug/variants/:size',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Remove a pack size',
        description:
          'Only for a pack that has never been ordered: removing one with orders would also erase its stock history. Set its stock to zero instead. A product keeps at least one pack.',
        params: z.object({ slug: slugSchema, size: z.string().min(1).max(60) }),
        response: { 200: z.object({ ok: z.literal(true) }), 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const product = await db.query.products.findFirst({
        where: eq(products.slug, request.params.slug),
        with: { variants: true },
      })
      const variant = product?.variants.find((v) => v.size === request.params.size)
      if (!product || !variant) throw ApiError.notFound(`Pack "${request.params.size}" of "${request.params.slug}"`)
      if (product.variants.length === 1) {
        throw ApiError.conflict('last_pack', 'A product needs at least one pack. Add another before removing this one.')
      }
      const ordered = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(and(isNotNull(orderItems.variantId), eq(orderItems.variantId, variant.id)))
        .limit(1)
      if (ordered.length > 0) {
        throw ApiError.conflict(
          'pack_has_orders',
          `"${variant.size}" has been ordered before, so it is kept for the records. Set its stock to 0 to stop selling it.`,
        )
      }

      await db.delete(productVariants).where(eq(productVariants.id, variant.id))
      return { ok: true as const }
    },
  )
}
