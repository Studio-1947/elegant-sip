import { and, eq, gt, inArray, isNotNull, isNull, lte } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { alertStaff } from './alerts.js'
import { getStoreSettings } from './settings.js'

/**
 * Called after any stock movement has committed. A pack of a tea on sale that
 * is at or under the threshold emails staff once; the mark is cleared when the
 * pack is restocked above it, so the next dip alerts again.
 *
 * The mark is claimed with a conditional UPDATE, so two checkouts taking the
 * last packs at once still send one email. Never throws: the stock change has
 * already happened and a missed alert must not fail it.
 */
export async function checkLowStock(
  variantIds: readonly string[],
  options: { log?: FastifyBaseLogger; alert?: typeof alertStaff } = {},
): Promise<number> {
  const { log, alert = alertStaff } = options
  const ids = [...new Set(variantIds)]
  if (ids.length === 0) return 0
  try {
    const { lowStockThreshold: threshold } = await getStoreSettings()

    await db
      .update(productVariants)
      .set({ lowStockAlertedAt: null })
      .where(and(inArray(productVariants.id, ids), gt(productVariants.stock, threshold), isNotNull(productVariants.lowStockAlertedAt)))

    // Coming-soon and archived teas have no stock by design; only teas on sale can run low.
    const onSale = db
      .select({ id: productVariants.id })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .where(and(inArray(productVariants.id, ids), eq(products.status, 'active'), isNull(products.archivedAt)))
    const marked = await db
      .update(productVariants)
      .set({ lowStockAlertedAt: new Date() })
      .where(
        and(
          inArray(productVariants.id, onSale),
          lte(productVariants.stock, threshold),
          isNull(productVariants.lowStockAlertedAt),
        ),
      )
      .returning({ id: productVariants.id, productId: productVariants.productId, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock })
    if (marked.length === 0) return 0

    const names = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, [...new Set(marked.map((v) => v.productId))]))
    const nameOf = new Map(names.map((p) => [p.id, p.name]))
    const soldOut = marked.filter((v) => v.stock === 0).length
    await alert({
      subject: marked.length === 1 ? 'A tea is running low' : `${marked.length} teas are running low`,
      body: [
        `${marked.length === 1 ? 'This pack has' : 'These packs have'} reached the low-stock threshold of ${threshold}.${soldOut ? ` ${soldOut} ${soldOut === 1 ? 'is' : 'are'} sold out and cannot be ordered.` : ''}`,
        'Restock from the admin page. You will not be emailed about the same pack again until it has been restocked above the threshold.',
      ],
      facts: marked.map((v) => [`${nameOf.get(v.productId) ?? v.sku} (${v.size})`, v.stock === 0 ? 'Sold out' : `${v.stock} left`]),
    })
    return marked.length
  } catch (err) {
    log?.error({ err }, 'low-stock check failed')
    if (!log) console.error('[low-stock] check failed', err)
    return 0
  }
}
