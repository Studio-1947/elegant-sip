import { asc, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { env } from '../env.js'
import { defaultVariant } from '../lib/catalogue-pricing.js'
import { metaFeedCsv, type FeedProduct } from '../lib/meta-feed.js'

export const feedRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/feeds/meta.csv',
    {
      schema: {
        tags: ['Catalogue'],
        summary: 'Meta product feed (CSV)',
        description: [
          'Built live from the database on every request, so a price change in the admin reaches',
          'Meta on its next scheduled fetch with no sync or redeploy.',
          '',
          'One row per product, for the pack the product page opens on. `sale_price` is exactly',
          'what checkout charges for one pack and is sent only when lower than `price`.',
          'Coming-soon and unlisted products are omitted. Cached for 5 minutes.',
        ].join('\n'),
        produces: ['text/csv'],
        response: { 200: z.string() },
      },
    },
    async (_request, reply) => {
      const rows = await db.query.products.findMany({
        where: eq(products.listed, true),
        with: { variants: { orderBy: asc(productVariants.sortOrder) } },
        orderBy: asc(products.sortOrder),
      })

      const items: FeedProduct[] = []
      for (const p of rows) {
        const variant = defaultVariant(p.variants)
        if (!variant) continue
        items.push({
          slug: p.slug,
          name: p.name,
          status: p.status,
          description: p.description,
          longDescription: p.longDescription,
          imageSrc: p.imageSrc,
          images: p.images,
          category: p.category,
          variant,
        })
      }

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .header('Cache-Control', 'public, max-age=300')
        .send(metaFeedCsv(items, env.SITE_URL))
    },
  )
}
