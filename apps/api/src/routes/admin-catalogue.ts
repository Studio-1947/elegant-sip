import { and, asc, eq, isNotNull, type SQL } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema, productSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'
import { toProductDto } from '../lib/mappers.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — the staff view of the catalogue, and offers.
 *
 * Registered from admin-products.ts, so the admin role check and audit hook
 * on the parent plugin cover every route here.
 * ──────────────────────────────────────────────────────────────────────────── */

export const offerActionSchema = z
  .enum(['end-offer', 'clear-compare-at'])
  .describe('`end-offer`: the selling price goes back up to the regular price. `clear-compare-at`: keep the selling price, drop the struck-out one')

type OfferAction = z.infer<typeof offerActionSchema>
type Prices = { price: number; compareAtPrice: number | null }

/** What one action does to one variant. Only variants that carry a struck-out price are touched. */
export function planOfferChange(action: OfferAction, before: Prices): Prices {
  if (before.compareAtPrice === null) return before
  return action === 'end-offer'
    ? { price: before.compareAtPrice, compareAtPrice: null }
    : { price: before.price, compareAtPrice: null }
}

const pricesSchema = z.object({ price: paiseSchema, compareAtPrice: paiseSchema.nullable() })
const offerChangeSchema = z.object({
  productSlug: slugSchema,
  productName: z.string(),
  retired: z.boolean(),
  size: z.string(),
  before: pricesSchema,
  after: pricesSchema,
})
const offerScopeSchema = z.object({
  action: offerActionSchema,
  productSlug: slugSchema.optional().describe('One tea; omit for every tea'),
})

export const adminCatalogueRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/products',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Every product, for staff',
        description:
          'Unlike `GET /products`, this includes retired products, with `archivedAt` set. Catalogue order.',
        response: { 200: z.object({ products: z.array(productSchema) }) },
      },
    },
    async () => {
      const rows = await db.query.products.findMany({
        with: { variants: { orderBy: asc(productVariants.sortOrder) }, reviews: true },
        orderBy: asc(products.sortOrder),
      })
      return { products: rows.map(toProductDto) }
    },
  )

  /** The planned change for every variant on offer within the scope, in catalogue order. */
  async function planOffers(
    action: OfferAction,
    productSlug: string | undefined,
    tx: Pick<typeof db, 'select' | 'query'> = db,
    lock = false,
  ) {
    if (productSlug) {
      const exists = await tx.query.products.findFirst({ where: eq(products.slug, productSlug), columns: { id: true } })
      if (!exists) throw ApiError.notFound(`Product "${productSlug}"`)
    }
    const where: SQL[] = [isNotNull(productVariants.compareAtPrice)]
    if (productSlug) where.push(eq(products.slug, productSlug))
    const query = tx
      .select({
        id: productVariants.id,
        productSlug: products.slug,
        productName: products.name,
        archivedAt: products.archivedAt,
        size: productVariants.size,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(...where))
      .orderBy(asc(products.sortOrder), asc(productVariants.sortOrder))
    const rows = lock ? await query.for('update', { of: productVariants }) : await query
    return rows.map((row) => {
      const before = { price: row.price, compareAtPrice: row.compareAtPrice }
      return {
        id: row.id,
        change: {
          productSlug: row.productSlug,
          productName: row.productName,
          retired: row.archivedAt !== null,
          size: row.size,
          before,
          after: planOfferChange(action, before),
        },
      }
    })
  }

  app.get(
    '/admin/offers/preview',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Preview ending offers',
        description: 'Exactly what `POST /admin/offers` with the same scope would change, without changing it.',
        querystring: offerScopeSchema,
        response: { 200: z.object({ changes: z.array(offerChangeSchema) }), 404: problemSchema },
      },
    },
    async (request) => {
      const { action, productSlug } = request.query
      const planned = await planOffers(action, productSlug)
      return { changes: planned.map(({ change }) => change) }
    },
  )

  app.post(
    '/admin/offers',
    {
      schema: {
        tags: ['Admin'],
        summary: 'End offers',
        description: [
          'Ends the offer on one tea or on every tea, in one transaction.',
          '',
          '`end-offer` sets the selling price to the regular (struck-out) price and clears the struck-out',
          'price. `clear-compare-at` keeps the selling price and only removes the struck-out price.',
          'Variants with no struck-out price are left alone. Returns what actually changed.',
        ].join('\n'),
        body: offerScopeSchema,
        response: { 200: z.object({ changes: z.array(offerChangeSchema) }), 404: problemSchema },
      },
    },
    async (request) => {
      const { action, productSlug } = request.body
      const changes = await db.transaction(async (tx) => {
        // Locked, so the prices changed are exactly the prices read.
        const planned = await planOffers(action, productSlug, tx, true)
        for (const { id, change } of planned) {
          await tx.update(productVariants).set(change.after).where(eq(productVariants.id, id))
        }
        return planned.map(({ change }) => change)
      })
      return { changes }
    },
  )
}
