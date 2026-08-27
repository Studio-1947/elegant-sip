import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { gardenSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { gardens } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'

/*
 * Gardens carry their linked products through a join table, so "the garden is
 * the brand" is enforced by foreign keys. The previous arrangement matched a
 * free-text estate name against a garden name and silently resolved to nothing.
 */
const withProducts = {
  productLinks: { with: { product: { columns: { slug: true } } } },
} as const

const toDto = (row: {
  id: string
  slug: string
  name: string
  region: string
  elevation: string
  imageSrc: string
  story: string[]
  productLinks: { product: { slug: string } }[]
}) => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  region: row.region,
  elevation: row.elevation,
  imageSrc: row.imageSrc,
  story: row.story ?? [],
  productSlugs: row.productLinks.map((l) => l.product.slug),
})

export const gardenRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/gardens',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'List the gardens',
        response: { 200: z.object({ gardens: z.array(gardenSchema) }) },
      },
    },
    async () => {
      const rows = await db.query.gardens.findMany({ with: withProducts, orderBy: asc(gardens.sortOrder) })
      return { gardens: rows.map(toDto) }
    },
  )

  app.get(
    '/gardens/:slug',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'Get one garden',
        params: z.object({ slug: slugSchema }),
        response: { 200: gardenSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const row = await db.query.gardens.findFirst({
        where: eq(gardens.slug, request.params.slug),
        with: withProducts,
      })
      if (!row) throw ApiError.notFound(`Garden "${request.params.slug}"`)
      return toDto(row)
    },
  )
}
