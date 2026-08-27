import { eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { gardenProducts, gardens, productVariants, products } from '../db/schema.js'
import { stockLedger } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — the catalogue.
 *
 * Split from admin.ts to keep both files under the project's 300-line rule.
 * The admin auth hook lives on the parent plugin, so every route here inherits
 * it: a new route cannot accidentally ship unauthenticated.
 * ──────────────────────────────────────────────────────────────────────────── */

const originSchema = z.object({
  origin: z.string().trim().min(2).max(120),
  estate: z.string().trim().min(2).max(80),
  elevation: z.string().trim().max(60),
  harvest: z.string().trim().max(60),
  cultivar: z.string().trim().max(120),
})

const flavorSchema = z.object({
  strength: z.number().int().min(1).max(5),
  astringency: z.number().int().min(1).max(5),
  sweetness: z.number().int().min(1).max(5),
  floral: z.number().int().min(1).max(5),
  caffeine: z.number().int().min(1).max(5),
})

const brewingSchema = z.object({
  temperature: z.string().trim().max(40),
  time: z.string().trim().max(40),
  steeps: z.string().trim().max(20),
  leafAmount: z.string().trim().max(40),
  notes: z.string().trim().max(400),
})

/** Derived and stable: slug + tier, matching the seed convention. */
const skuFor = (slug: string, size: string) =>
  `${slug}--${size.split(' · ')[0].toLowerCase().replace(/\s+/g, '-')}`

export const adminProductRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/admin/products',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Add a product',
        description: [
          'Creates a product and its variants in one transaction.',
          '',
          'A tea with no price yet should be created as `coming-soon` with a zero-price,',
          'zero-stock variant. The storefront then shows a badge rather than "₹0", which',
          'would read as free, and no JSON-LD offer is emitted for it.',
        ].join('\n'),
        body: z.object({
          slug: slugSchema,
          name: z.string().trim().min(2).max(120),
          status: z.enum(['active', 'coming-soon']).default('active'),
          description: z.string().trim().min(10).max(600),
          longDescription: z.string().trim().max(4000).optional(),
          imageSrc: z.string().trim().min(1).max(200),
          category: z.string().trim().min(2).max(60),
          tastingNotes: z.array(z.string().trim().max(40)).max(8).default([]),
          bodyLevel: z.number().int().min(1).max(5).optional(),
          harvestLabel: z.string().trim().max(60).optional(),
          origin: originSchema.optional(),
          flavorProfile: flavorSchema.optional(),
          brewingGuide: brewingSchema.optional(),
          gardenSlug: slugSchema.optional().describe('Links the product to a garden, in both directions'),
          variants: z
            .array(
              z.object({
                size: z.string().trim().min(1).max(60).describe('e.g. "Premium · 100 g"'),
                price: paiseSchema,
                stock: z.number().int().min(0).default(0),
              }),
            )
            .min(1)
            .max(10),
        }),
        response: {
          200: z.object({ slug: slugSchema, variantCount: z.number().int() }),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const { variants, gardenSlug, ...fields } = request.body

      const clash = await db.query.products.findFirst({ where: eq(products.slug, fields.slug) })
      if (clash) {
        throw ApiError.conflict('slug_taken', `A product with the slug "${fields.slug}" already exists.`)
      }

      const [{ max }] = await db
        .select({ max: sql<number>`COALESCE(MAX(${products.sortOrder}), -1)` })
        .from(products)

      await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(products)
          .values({
            slug: fields.slug,
            name: fields.name,
            status: fields.status,
            description: fields.description,
            longDescription: fields.longDescription ?? null,
            imageSrc: fields.imageSrc,
            category: fields.category,
            tastingNotes: fields.tastingNotes,
            bodyLevel: fields.bodyLevel ?? null,
            harvestLabel: fields.harvestLabel ?? null,
            origin: fields.origin ?? null,
            flavorProfile: fields.flavorProfile ?? null,
            brewingGuide: fields.brewingGuide ?? null,
            // New teas land at the end of the catalogue order.
            sortOrder: Number(max) + 1,
          })
          .returning({ id: products.id })

        const created = await tx
          .insert(productVariants)
          .values(
            variants.map((v, i) => ({
              productId: row.id,
              size: v.size,
              sku: skuFor(fields.slug, v.size),
              price: v.price,
              stock: v.stock,
              sortOrder: i,
            })),
          )
          .returning({ id: productVariants.id, stock: productVariants.stock })

        // Opening stock is a ledger movement like any other, so the running
        // total always has an explanation behind it.
        for (const v of created) {
          if (v.stock > 0) {
            await tx.insert(stockLedger).values({ variantId: v.id, delta: v.stock, reason: 'seed' })
          }
        }

        if (gardenSlug) {
          const garden = await tx.query.gardens.findFirst({ where: eq(gardens.slug, gardenSlug) })
          if (!garden) throw ApiError.notFound(`Garden "${gardenSlug}"`)
          await tx.insert(gardenProducts).values({ gardenId: garden.id, productId: row.id })
        }
      })

      return { slug: fields.slug, variantCount: variants.length }
    },
  )

  app.patch(
    '/admin/products/:slug',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Edit a product',
        description:
          'Partial update — omitted fields are left alone. Editing a product never alters a past order: order lines carry a price snapshot taken at purchase.',
        params: z.object({ slug: slugSchema }),
        body: z.object({
          name: z.string().trim().min(2).max(120).optional(),
          status: z.enum(['active', 'coming-soon']).optional(),
          description: z.string().trim().min(10).max(600).optional(),
          longDescription: z.string().trim().max(4000).nullable().optional(),
          imageSrc: z.string().trim().min(1).max(200).optional(),
          category: z.string().trim().min(2).max(60).optional(),
          tastingNotes: z.array(z.string().trim().max(40)).max(8).optional(),
          bodyLevel: z.number().int().min(1).max(5).nullable().optional(),
          harvestLabel: z.string().trim().max(60).nullable().optional(),
          origin: originSchema.nullable().optional(),
          flavorProfile: flavorSchema.nullable().optional(),
          brewingGuide: brewingSchema.nullable().optional(),
          sortOrder: z.number().int().min(0).optional(),
        }),
        response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema, 404: problemSchema },
      },
    },
    async (request) => {
      if (Object.keys(request.body).length === 0) {
        throw ApiError.badRequest('Send at least one field to change.')
      }
      const rows = await db
        .update(products)
        .set({ ...request.body, updatedAt: new Date() })
        .where(eq(products.slug, request.params.slug))
        .returning({ id: products.id })
      if (rows.length === 0) throw ApiError.notFound(`Product "${request.params.slug}"`)
      return { ok: true as const }
    },
  )

  app.post(
    '/admin/products/:slug/variants',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Add a variant',
        params: z.object({ slug: slugSchema }),
        body: z.object({
          size: z.string().trim().min(1).max(60),
          price: paiseSchema,
          stock: z.number().int().min(0).default(0),
        }),
        response: {
          200: z.object({ slug: slugSchema, size: z.string(), price: paiseSchema, stock: z.number().int() }),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const product = await db.query.products.findFirst({
        where: eq(products.slug, request.params.slug),
        with: { variants: true },
      })
      if (!product) throw ApiError.notFound(`Product "${request.params.slug}"`)
      if (product.variants.some((v) => v.size === request.body.size)) {
        throw ApiError.conflict('variant_exists', `"${request.body.size}" already exists on this tea.`)
      }

      const { size, price, stock } = request.body
      await db.transaction(async (tx) => {
        const [variant] = await tx
          .insert(productVariants)
          .values({
            productId: product.id,
            size,
            sku: skuFor(product.slug, size),
            price,
            stock,
            sortOrder: product.variants.length,
          })
          .returning({ id: productVariants.id })
        if (stock > 0) {
          await tx.insert(stockLedger).values({ variantId: variant.id, delta: stock, reason: 'seed' })
        }
      })

      return { slug: product.slug, size, price, stock }
    },
  )

  app.patch(
    '/admin/products/:slug/variants/:size',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Change a variant price',
        description:
          'Stock is deliberately not settable here — use `POST /admin/stock`, which records the movement in the ledger. Writing stock directly would leave an unexplained jump in the running total.',
        params: z.object({ slug: slugSchema, size: z.string().min(1).max(60) }),
        body: z.object({ price: paiseSchema }),
        response: {
          200: z.object({ slug: slugSchema, size: z.string(), price: paiseSchema }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const variant = await db
        .select({ id: productVariants.id, size: productVariants.size })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(products.slug, request.params.slug))
        .then((rows) => rows.find((r) => r.size === request.params.size))

      if (!variant) {
        throw ApiError.notFound(`Variant "${request.params.size}" of "${request.params.slug}"`)
      }

      const [updated] = await db
        .update(productVariants)
        .set({ price: request.body.price })
        .where(eq(productVariants.id, variant.id))
        .returning({ price: productVariants.price })

      return { slug: request.params.slug, size: variant.size, price: updated.price }
    },
  )
}
