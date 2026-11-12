import { desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { products, reviews } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — review moderation.
 *
 * Customer reviews are saved unpublished. Staff list them here and publish or
 * unpublish them. Registered inside admin.ts, so the admin auth hook covers it.
 * ──────────────────────────────────────────────────────────────────────────── */

export const adminReviewRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/reviews',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Reviews to moderate',
        description:
          'Newest first. `pending` (the default) is reviews not yet published. `verified` is derived from paid orders, never from the customer.',
        querystring: z.object({
          status: z.enum(['pending', 'published', 'all']).default('pending'),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).max(10_000).default(0),
        }),
        response: {
          200: z.object({
            reviews: z.array(
              z.object({
                id: z.string().uuid(),
                productSlug: slugSchema,
                productName: z.string(),
                authorName: z.string(),
                rating: z.number().int().min(1).max(5),
                body: z.string(),
                verified: z.boolean(),
                createdAt: z.iso.datetime(),
                publishedAt: z.iso.datetime().nullable(),
              }),
            ),
            hasMore: z.boolean(),
          }),
          401: problemSchema,
          403: problemSchema,
        },
      },
    },
    async (request) => {
      const { status, limit, offset } = request.query
      const where =
        status === 'pending' ? isNull(reviews.publishedAt) : status === 'published' ? isNotNull(reviews.publishedAt) : undefined
      // One extra row tells us whether another page exists without a count query.
      const rows = await db
        .select({
          id: reviews.id,
          productSlug: products.slug,
          productName: products.name,
          authorName: reviews.authorName,
          rating: reviews.rating,
          body: reviews.body,
          verified: reviews.verified,
          createdAt: reviews.createdAt,
          publishedAt: reviews.publishedAt,
        })
        .from(reviews)
        .innerJoin(products, eq(reviews.productId, products.id))
        .where(where)
        .orderBy(desc(reviews.createdAt), desc(reviews.id))
        .limit(limit + 1)
        .offset(offset)
      return {
        reviews: rows.slice(0, limit).map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          publishedAt: r.publishedAt?.toISOString() ?? null,
        })),
        hasMore: rows.length > limit,
      }
    },
  )

  app.patch(
    '/admin/reviews/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Publish or unpublish a review',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ published: z.boolean() }),
        response: { 200: z.object({ ok: z.literal(true) }), 404: problemSchema },
      },
    },
    async (request) => {
      const rows = await db
        .update(reviews)
        .set({ publishedAt: request.body.published ? new Date() : null })
        .where(eq(reviews.id, request.params.id))
        .returning({ id: reviews.id })
      if (rows.length === 0) throw ApiError.notFound('That review')
      return { ok: true as const }
    },
  )
}
