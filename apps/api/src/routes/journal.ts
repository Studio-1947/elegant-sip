import { desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { journalPostSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { journalPosts } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'

type Row = typeof journalPosts.$inferSelect

/* publishedAt is a date-only string in the API: schema.org's datePublished
   rejects "March 12, 2026", and the storefront emits it into BlogPosting. */
const toDto = (row: Row) => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  excerpt: row.excerpt,
  category: row.category,
  author: row.author,
  publishedAt: row.publishedAt.toISOString().slice(0, 10),
  readTime: row.readTime,
  imageSrc: row.imageSrc,
  imageAlt: row.imageAlt,
  body: row.body ?? [],
})

export const journalRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/journal',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'List journal posts, newest first',
        response: { 200: z.object({ posts: z.array(journalPostSchema) }) },
      },
    },
    async () => {
      const rows = await db.select().from(journalPosts).orderBy(desc(journalPosts.publishedAt))
      return { posts: rows.map(toDto) }
    },
  )

  app.get(
    '/journal/:slug',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'Get one journal post',
        params: z.object({ slug: slugSchema }),
        response: { 200: journalPostSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const row = await db.query.journalPosts.findFirst({ where: eq(journalPosts.slug, request.params.slug) })
      if (!row) throw ApiError.notFound(`Journal post "${request.params.slug}"`)
      return toDto(row)
    },
  )
}
