import { and, asc, desc, eq, isNull, lte, sql, type SQL } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { orderItems, orders, stockLedger } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { checkLowStock } from '../lib/low-stock.js'
import { getStoreSettings } from '../lib/settings.js'
import { packGrams } from '../lib/fulfilment.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — inventory.
 *
 * Stock lives on the variant row as a running total; every change goes
 * through the append-only stock ledger with a reason, so the total always has
 * an explanation. Stock is taken when a customer starts paying and returned if
 * the checkout expires, so `held` shows what unpaid checkouts are holding.
 *
 * Registered inside admin.ts, so the admin role check and audit log cover it.
 * ──────────────────────────────────────────────────────────────────────────── */

export const STOCK_REASONS = ['restock', 'damaged', 'sample', 'count_correction', 'manual_adjustment'] as const
const ALL_REASONS = ['seed', 'order_reserved', 'order_released', 'order_fulfilled', ...STOCK_REASONS] as const

const adjustSchema = z
  .object({
    productSlug: slugSchema,
    variantSize: z.string().min(1),
    delta: z.number().int().refine((n) => n !== 0, 'Delta must be non-zero').optional().describe('Add (positive) or remove (negative) this many'),
    setTo: z.number().int().min(0).max(1_000_000).optional().describe('Or: the counted stock on the shelf; the difference is recorded'),
    reason: z.enum(STOCK_REASONS).optional().describe('Defaults to restock (+), manual_adjustment (−) or count_correction (setTo)'),
    note: z.string().trim().max(200).optional(),
  })
  .refine((b) => (b.delta === undefined) !== (b.setTo === undefined), 'Send either delta or setTo.')

export const adminInventoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/admin/stock',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Adjust stock',
        description: [
          'Applies a change and records it in the append-only ledger with a reason.',
          '',
          '`delta` adds or removes packs. `setTo` records a stock count: the variant row is locked, the difference from',
          'the current total is computed and recorded, so an order placed meanwhile is not overwritten by stale numbers.',
          '`restock` must add stock; `damaged` and `sample` must remove it.',
        ].join('\n'),
        body: adjustSchema,
        response: {
          200: z.object({ productSlug: slugSchema, variantSize: z.string(), stock: z.number().int(), delta: z.number().int() }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const { productSlug, variantSize, note } = request.body
      const variant = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(products.slug, productSlug), eq(productVariants.size, variantSize)))
        .then((rows) => rows[0])
      if (!variant) throw ApiError.notFound(`Variant "${variantSize}" of "${productSlug}"`)

      const result = await db.transaction(async (tx) => {
        const [locked] = await tx.select({ stock: productVariants.stock }).from(productVariants).where(eq(productVariants.id, variant.id)).for('update')
        const delta = request.body.setTo !== undefined ? request.body.setTo - locked.stock : request.body.delta!
        if (delta === 0) return { stock: locked.stock, delta }
        const reason = request.body.reason ?? (request.body.setTo !== undefined ? 'count_correction' : delta > 0 ? 'restock' : 'manual_adjustment')
        if (reason === 'restock' && delta < 0) throw ApiError.badRequest('A restock must add stock. Use damaged, sample or a stock count to remove packs.')
        if ((reason === 'damaged' || reason === 'sample') && delta > 0) throw ApiError.badRequest(`"${reason}" removes stock; it cannot add it.`)
        if (locked.stock + delta < 0) {
          throw ApiError.badRequest(`That would take stock to ${locked.stock + delta}. Current stock is ${locked.stock}.`)
        }
        const [row] = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${delta}` })
          .where(eq(productVariants.id, variant.id))
          .returning({ stock: productVariants.stock })
        await tx.insert(stockLedger).values({ variantId: variant.id, delta, reason, note: note ?? null })
        return { stock: row.stock, delta }
      })
      if (result.delta !== 0) await checkLowStock([variant.id], { log: request.log })
      return { productSlug, variantSize, ...result }
    },
  )

  app.get(
    '/admin/stock/low',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Low-stock variants of teas on sale, for the staff dashboard',
        description: 'Without `threshold`, uses the low-stock threshold from the shop settings.',
        querystring: z.object({ threshold: z.coerce.number().int().min(0).max(1000).optional() }),
        response: { 200: z.object({ variants: z.array(z.object({ productSlug: slugSchema, productName: z.string(), size: z.string(), sku: z.string(), stock: z.number().int() })) }) },
      },
    },
    async (request) => {
      const threshold = request.query.threshold ?? (await getStoreSettings()).lowStockThreshold
      const variants = await db
        .select({ productSlug: products.slug, productName: products.name, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        // Coming-soon and retired teas aren't on sale, so they can't run low.
        .where(and(lte(productVariants.stock, threshold), eq(products.status, 'active'), isNull(products.archivedAt)))
        .orderBy(productVariants.stock, products.name, productVariants.size)
      return { variants }
    },
  )

  app.get(
    '/admin/inventory',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Every pack with its stock',
        description:
          '`stock` is what can still be sold. `held` is what unpaid checkouts are holding (already taken off `stock`; it comes back if they expire). `weightGrams` is the packed weight used for courier bookings — set, or read from the size label.',
        response: {
          200: z.object({
            threshold: z.number().int(),
            variants: z.array(
              z.object({
                productSlug: slugSchema,
                productName: z.string(),
                productStatus: z.string(),
                retired: z.boolean(),
                size: z.string(),
                sku: z.string(),
                price: paiseSchema,
                stock: z.number().int(),
                held: z.number().int(),
                weightGrams: z.number().int(),
                weightIsSet: z.boolean(),
                low: z.boolean(),
              }),
            ),
          }),
        },
      },
    },
    async () => {
      const [{ lowStockThreshold: threshold }, rows, heldRows] = await Promise.all([
        getStoreSettings(),
        db
          .select({
            id: productVariants.id,
            productSlug: products.slug,
            productName: products.name,
            productStatus: products.status,
            archivedAt: products.archivedAt,
            size: productVariants.size,
            sku: productVariants.sku,
            price: productVariants.price,
            stock: productVariants.stock,
            weightGrams: productVariants.weightGrams,
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .orderBy(asc(products.sortOrder), asc(productVariants.sortOrder)),
        db
          .select({ variantId: orderItems.variantId, held: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(eq(orders.status, 'pending_payment'))
          .groupBy(orderItems.variantId),
      ])
      const held = new Map(heldRows.map((r) => [r.variantId, r.held]))
      return {
        threshold,
        variants: rows.map((r) => {
          const onSale = r.productStatus === 'active' && r.archivedAt === null
          return {
            productSlug: r.productSlug,
            productName: r.productName,
            productStatus: r.productStatus,
            retired: r.archivedAt !== null,
            size: r.size,
            sku: r.sku,
            price: r.price,
            stock: r.stock,
            held: held.get(r.id) ?? 0,
            weightGrams: r.weightGrams ?? packGrams(r.size),
            weightIsSet: r.weightGrams !== null,
            low: onSale && r.stock <= threshold,
          }
        }),
      }
    },
  )

  app.get(
    '/admin/stock/ledger',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Stock history',
        description: 'Every stock movement, newest first. Filter to one tea, or one pack of it.',
        querystring: z.object({
          productSlug: slugSchema.optional(),
          size: z.string().min(1).max(60).optional(),
          reason: z.enum(ALL_REASONS).optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: {
          200: z.object({
            entries: z.array(
              z.object({
                id: z.string().uuid(),
                at: z.iso.datetime(),
                productSlug: slugSchema,
                productName: z.string(),
                size: z.string(),
                delta: z.number().int(),
                reason: z.string(),
                note: z.string().nullable(),
                orderNumber: z.string().nullable(),
              }),
            ),
            hasMore: z.boolean(),
          }),
        },
      },
    },
    async (request) => {
      const { productSlug, size, reason, limit, offset } = request.query
      const where: SQL[] = []
      if (productSlug) where.push(eq(products.slug, productSlug))
      if (size) where.push(eq(productVariants.size, size))
      if (reason) where.push(eq(stockLedger.reason, reason))
      const rows = await db
        .select({
          id: stockLedger.id,
          at: stockLedger.createdAt,
          productSlug: products.slug,
          productName: products.name,
          size: productVariants.size,
          delta: stockLedger.delta,
          reason: stockLedger.reason,
          note: stockLedger.note,
          orderNumber: orders.number,
        })
        .from(stockLedger)
        .innerJoin(productVariants, eq(stockLedger.variantId, productVariants.id))
        .innerJoin(products, eq(productVariants.productId, products.id))
        .leftJoin(orders, eq(stockLedger.orderId, orders.id))
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(stockLedger.createdAt), desc(stockLedger.id))
        .limit(limit + 1)
        .offset(offset)
      return {
        entries: rows.slice(0, limit).map((r) => ({ ...r, at: r.at.toISOString() })),
        hasMore: rows.length > limit,
      }
    },
  )
}
