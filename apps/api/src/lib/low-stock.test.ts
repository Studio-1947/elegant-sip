import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db, sql } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { checkLowStock } from './low-stock.js'
import { getStoreSettings } from './settings.js'

/* Uses its own throwaway teas so concurrent suites' stock is never touched. */

const TAG = `lowstock-${Date.now()}`
let available = true
let threshold = 5
const productIds: string[] = []
const v: Record<'a' | 'b' | 'plenty' | 'comingSoon' | 'archived', string> = { a: '', b: '', plenty: '', comingSoon: '', archived: '' }

async function addTea(label: string, extra: Partial<typeof products.$inferInsert>, sizes: [string, number][]) {
  const [product] = await db
    .insert(products)
    .values({ slug: `${TAG}-${label}`, name: `Test ${label}`, description: 'x', imageSrc: '/x.webp', category: 'test', ...extra })
    .returning({ id: products.id })
  productIds.push(product.id)
  const variants = await db
    .insert(productVariants)
    .values(sizes.map(([size, stock]) => ({ productId: product.id, size, sku: `${TAG}-${label}-${size}`, price: 10_000, stock })))
    .returning({ id: productVariants.id })
  return variants.map((row) => row.id)
}

const alertedAt = async (id: string) =>
  (await db.select({ at: productVariants.lowStockAlertedAt }).from(productVariants).where(eq(productVariants.id, id)))[0].at
const setStock = (id: string, stock: number) => db.update(productVariants).set({ stock }).where(eq(productVariants.id, id))

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
    return
  }
  threshold = (await getStoreSettings()).lowStockThreshold
  ;[v.a, v.b, v.plenty] = await addTea('on-sale', {}, [['50g', threshold], ['100g', threshold + 10], ['250g', threshold + 50]])
  ;[v.comingSoon] = await addTea('coming-soon', { status: 'coming-soon' }, [['50g', 0]])
  ;[v.archived] = await addTea('archived', { archivedAt: new Date() }, [['50g', 0]])
})

afterAll(async () => {
  if (available && productIds.length) await db.delete(products).where(inArray(products.id, productIds))
  await sql.end({ timeout: 5 }).catch(() => {})
})

describe('checkLowStock', () => {
  it('emails once when a pack on sale reaches the threshold, and not again until restocked', async () => {
    if (!available) return
    const alert = vi.fn(async (_alert: { subject: string; body: string[]; facts?: [string, string][] }) => {})
    expect(await checkLowStock([v.a, v.plenty], { alert })).toBe(1)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0][0].facts).toEqual([['Test on-sale (50g)', threshold === 0 ? 'Sold out' : `${threshold} left`]])
    expect(await alertedAt(v.a)).not.toBeNull()
    expect(await alertedAt(v.plenty)).toBeNull()

    // Still low: no second email.
    await checkLowStock([v.a], { alert })
    expect(alert).toHaveBeenCalledTimes(1)

    // Restocked above the threshold: the mark clears, so the next dip alerts again.
    await setStock(v.a, threshold + 1)
    expect(await checkLowStock([v.a], { alert })).toBe(0)
    expect(await alertedAt(v.a)).toBeNull()
    await setStock(v.a, threshold)
    await checkLowStock([v.a], { alert })
    expect(alert).toHaveBeenCalledTimes(2)
  })

  it('batches several packs into one email', async () => {
    if (!available) return
    await setStock(v.a, threshold + 1)
    await checkLowStock([v.a])
    await setStock(v.a, 0)
    await setStock(v.b, 0)
    const alert = vi.fn(async (_alert: { subject: string; facts?: [string, string][] }) => {})
    expect(await checkLowStock([v.a, v.b, v.a], { alert })).toBe(2)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0][0].subject).toBe('2 teas are running low')
    expect(alert.mock.calls[0][0].facts).toHaveLength(2)
  })

  it('ignores coming-soon and archived teas', async () => {
    if (!available) return
    const alert = vi.fn(async () => {})
    expect(await checkLowStock([v.comingSoon, v.archived], { alert })).toBe(0)
    expect(alert).not.toHaveBeenCalled()
    expect(await alertedAt(v.comingSoon)).toBeNull()
    expect(await alertedAt(v.archived)).toBeNull()
  })

  it('never throws, even when the alert does', async () => {
    if (!available) return
    await setStock(v.plenty, 0)
    const alert = vi.fn(async () => {
      throw new Error('mail down')
    })
    await expect(checkLowStock([v.plenty], { alert })).resolves.toBe(0)
  })
})
