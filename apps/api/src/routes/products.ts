import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema, productSchema, reviewSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { products, productVariants, reviews } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'
import { toProductDto } from '../lib/mappers.js'

export const productRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/products',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'List the catalogue',
        description:
          'Every product on the shop, in catalogue order — deliberately not alphabetical. Coming-soon products are included but carry a null `fromPrice`, because they have no price yet and inventing one would be a lie. Retired products are left out.',
        response: { 200: z.object({ products: z.array(productSchema) }) },
      },
    },
    async () => {
      const rows = await db.query.products.findMany({
        where: isNull(products.archivedAt),
        with: { variants: { orderBy: asc(productVariants.sortOrder) }, reviews: true },
        orderBy: asc(products.sortOrder),
      })
      return { products: rows.map(toProductDto) }
    },
  )

  app.get(
    '/products/:slug',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'Get one product',
        description: 'A retired product is 404, the same as one that never existed.',
        params: z.object({ slug: slugSchema }),
        response: { 200: productSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const row = await db.query.products.findFirst({
        where: and(eq(products.slug, request.params.slug), isNull(products.archivedAt)),
        with: { variants: { orderBy: asc(productVariants.sortOrder) }, reviews: true },
      })
      if (!row) throw ApiError.notFound(`Product "${request.params.slug}"`)
      return toProductDto(row)
    },
  )

  app.get(
    '/products/:slug/reviews',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'Published reviews for a product',
        description:
          'Only moderated reviews are returned. `verified` means a paid order from that customer actually contained this product — it is derived server-side and can never be self-asserted.',
        params: z.object({ slug: slugSchema }),
        response: {
          200: z.object({
            reviews: z.array(reviewSchema),
            average: z.number().min(0).max(5),
            count: z.number().int().nonnegative(),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const product = await db.query.products.findFirst({
        where: eq(products.slug, request.params.slug),
        columns: { id: true },
      })
      if (!product) throw ApiError.notFound(`Product "${request.params.slug}"`)

      const rows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.productId, product.id))
        .orderBy(asc(reviews.createdAt))

      const published = rows.filter((r) => r.publishedAt !== null)
      const count = published.length
      const average =
        count === 0 ? 0 : Math.round((published.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10

      return {
        reviews: published.map((r) => ({
          id: r.id,
          author: r.authorName,
          rating: r.rating,
          text: r.body,
          publishedAt: r.publishedAt!.toISOString(),
          verified: r.verified,
        })),
        average,
        count,
      }
    },
  )

  app.get(
    '/reviews/recent',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'The latest published reviews, across all teas',
        description:
          'For the homepage. Newest first at every rating — never filtered to the flattering ones. Empty until staff publish a review.',
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(12).default(6) }),
        response: {
          200: z.object({
            reviews: z.array(reviewSchema.extend({ productSlug: slugSchema, productName: z.string() })),
          }),
        },
      },
    },
    async (request) => {
      const rows = await db
        .select({
          id: reviews.id,
          author: reviews.authorName,
          rating: reviews.rating,
          text: reviews.body,
          publishedAt: reviews.publishedAt,
          verified: reviews.verified,
          productSlug: products.slug,
          productName: products.name,
        })
        .from(reviews)
        .innerJoin(products, eq(products.id, reviews.productId))
        // The homepage links each review to its tea, so retired teas' reviews stay off it.
        .where(and(isNotNull(reviews.publishedAt), isNull(products.archivedAt)))
        .orderBy(desc(reviews.publishedAt))
        .limit(request.query.limit)
      return { reviews: rows.map((r) => ({ ...r, publishedAt: r.publishedAt!.toISOString() })) }
    },
  )
}

/** Exported for the sitemap/prerender build to fetch slugs cheaply. */
export const publishedProductSlugs = () =>
  db.select({ slug: products.slug }).from(products).where(isNull(products.archivedAt))
