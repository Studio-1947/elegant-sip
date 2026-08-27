import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema, reviewSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { products, reviews } from '../db/schema.js'
import { newsletterSubscribers, users, wishlistItems } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { sendEmail } from '../lib/email.js'
import { hasPurchased } from './orders.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Customer account: reviews, wishlist, newsletter, contact.
 * ──────────────────────────────────────────────────────────────────────────── */

function requireUser(session: { userId: string } | null) {
  if (!session) {
    throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
  }
  return session
}

export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/products/:slug/reviews',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
      schema: {
        tags: ['Account'],
        summary: 'Write a review',
        description: [
          'Requires a signed-in account. **`verified` is decided here**, by checking whether a',
          'paid order from this customer actually contains the product — the client cannot assert it.',
          '',
          'Reviews are held unpublished until moderated, so the product page never shows',
          'something nobody has read.',
        ].join('\n'),
        params: z.object({ slug: slugSchema }),
        body: z.object({
          rating: z.number().int().min(1).max(5),
          text: z.string().trim().min(10).max(2000),
        }),
        response: {
          200: z.object({
            review: reviewSchema.omit({ publishedAt: true }).extend({
              publishedAt: z.iso.datetime().nullable(),
            }),
            pendingModeration: z.boolean(),
          }),
          401: problemSchema,
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const session = requireUser(request.session)
      const product = await db.query.products.findFirst({
        where: eq(products.slug, request.params.slug),
        columns: { id: true },
      })
      if (!product) throw ApiError.notFound(`Product "${request.params.slug}"`)

      const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
      if (!user) throw ApiError.notFound('Your account')

      // One review per customer per product.
      const existing = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.productId, product.id), eq(reviews.userId, session.userId)))
        .limit(1)
      if (existing.length > 0) {
        throw ApiError.conflict('already_reviewed', 'You have already reviewed this tea.')
      }

      const verified = await hasPurchased(session.userId, request.params.slug)

      const [row] = await db
        .insert(reviews)
        .values({
          productId: product.id,
          userId: session.userId,
          authorName: user.name,
          rating: request.body.rating,
          body: request.body.text,
          verified,
        })
        .returning()

      return {
        review: {
          id: row.id,
          author: row.authorName,
          rating: row.rating,
          text: row.body,
          publishedAt: null,
          verified: row.verified,
        },
        pendingModeration: true,
      }
    },
  )

  app.get(
    '/wishlist',
    {
      schema: {
        tags: ['Account'],
        summary: 'Your wishlist',
        response: { 200: z.object({ productSlugs: z.array(slugSchema) }), 401: problemSchema },
      },
    },
    async (request) => {
      const session = requireUser(request.session)
      const rows = await db
        .select({ slug: products.slug })
        .from(wishlistItems)
        .innerJoin(products, eq(wishlistItems.productId, products.id))
        .where(eq(wishlistItems.userId, session.userId))
      return { productSlugs: rows.map((r) => r.slug) }
    },
  )

  app.put(
    '/wishlist',
    {
      schema: {
        tags: ['Account'],
        summary: 'Replace your wishlist',
        description:
          'Idempotent whole-list replace. Used to merge a guest wishlist from localStorage on first sign-in, then to keep it in sync.',
        body: z.object({ productSlugs: z.array(slugSchema).max(100) }),
        response: { 200: z.object({ productSlugs: z.array(slugSchema) }), 401: problemSchema },
      },
    },
    async (request) => {
      const session = requireUser(request.session)
      const wanted = [...new Set(request.body.productSlugs)]

      const found = wanted.length
        ? await db.select({ id: products.id, slug: products.slug }).from(products)
        : []
      const keep = found.filter((p) => wanted.includes(p.slug))

      await db.transaction(async (tx) => {
        await tx.delete(wishlistItems).where(eq(wishlistItems.userId, session.userId))
        if (keep.length > 0) {
          await tx
            .insert(wishlistItems)
            .values(keep.map((p) => ({ userId: session.userId, productId: p.id })))
            .onConflictDoNothing()
        }
      })

      return { productSlugs: keep.map((p) => p.slug) }
    },
  )

  app.post(
    '/newsletter',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
      schema: {
        tags: ['Account'],
        summary: 'Subscribe to the newsletter',
        description:
          'Returns the welcome code in the response. The storefront shows it on screen rather than promising it by email — which it always did, and which is now also true of the API.',
        body: z.object({ email: z.string().trim().toLowerCase().email() }),
        response: { 200: z.object({ ok: z.literal(true), welcomeCode: z.string() }) },
      },
    },
    async (request) => {
      await db
        .insert(newsletterSubscribers)
        .values({ email: request.body.email })
        .onConflictDoNothing()
      return { ok: true as const, welcomeCode: 'WELCOME10' }
    },
  )

  app.post(
    '/contact',
    {
      config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
      schema: {
        tags: ['Account'],
        summary: 'Send a message',
        description:
          'Delivers to the shop inbox. `delivered` reports whether the message actually went out — the UI must not claim it was sent when this is false.',
        body: z.object({
          name: z.string().trim().min(2).max(80),
          email: z.string().trim().toLowerCase().email(),
          subject: z.string().trim().min(2).max(120),
          message: z.string().trim().min(10).max(4000),
        }),
        response: { 200: z.object({ delivered: z.boolean() }) },
      },
    },
    async (request) => {
      const { name, email, subject, message } = request.body
      const result = await sendEmail({
        to: env.CONTACT_INBOX,
        subject: `[${subject}] from ${name}`,
        heading: 'New message from the site',
        body: [message],
        facts: [
          ['From', name],
          ['Reply to', email],
        ],
      })
      return { delivered: result.delivered }
    },
  )
}
