import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db, sql } from './client.js'
import { productVariants, products, seedState } from './schema.js'
import { NEW_RANGE } from './seed-new-range.js'
import { seedProducts, type ProductSeed } from './seed.js'

/* The boot seed must never undo catalogue edits made in the admin dashboard. */

const slug = `seed-guard-${Date.now()}`
const noGardens = new Map<string, string>()

const definition = (variants: { size: string; price: number }[]): ProductSeed =>
  ({
    ...NEW_RANGE[0],
    slug,
    name: 'Seed Guard Tea',
    garden: undefined,
    variants: variants.map((v) => ({ ...v, sku: `${slug}-${v.size.replace(/\s+/g, '')}`, compareAtPrice: v.price + 10_000, stock: 5 })),
  }) as unknown as ProductSeed

let available = true

const variantPrices = async () => {
  const product = await db.query.products.findFirst({ where: eq(products.slug, slug), with: { variants: true } })
  return Object.fromEntries((product?.variants ?? []).map((v) => [v.size, v.price]))
}

const adminEditPrice = async (size: string, price: number) => {
  const product = await db.query.products.findFirst({ where: eq(products.slug, slug) })
  await db.update(productVariants).set({ price }).where(and(eq(productVariants.productId, product!.id), eq(productVariants.size, size)))
}

beforeAll(async () => {
  try {
    await sql`SELECT 1 FROM seed_state LIMIT 1`
  } catch {
    available = false
  }
})

afterAll(async () => {
  if (available) {
    await db.delete(products).where(eq(products.slug, slug))
    await db.delete(seedState).where(eq(seedState.key, `product:${slug}`))
  }
  await sql.end({ timeout: 5 }).catch(() => {})
})

describe('boot seed', () => {
  it('writes a new product, then leaves admin edits alone on every later run', async () => {
    if (!available) return
    expect((await seedProducts([definition([{ size: '100 g', price: 50_000 }])], noGardens)).applied).toBe(1)
    expect(await variantPrices()).toEqual({ '100 g': 50_000 })

    // Staff change the price and add a pack size in admin.
    await adminEditPrice('100 g', 45_000)
    const product = await db.query.products.findFirst({ where: eq(products.slug, slug) })
    await db.insert(productVariants).values({ productId: product!.id, size: '250 g', sku: `${slug}-250g-admin`, price: 99_000, stock: 3 })

    // A restart with the same seed file changes nothing.
    expect((await seedProducts([definition([{ size: '100 g', price: 50_000 }])], noGardens)).applied).toBe(0)
    expect(await variantPrices()).toEqual({ '100 g': 45_000, '250 g': 99_000 })
  })

  it('applies a deliberate change to the seed file, without deleting sizes added in admin', async () => {
    if (!available) return
    expect((await seedProducts([definition([{ size: '100 g', price: 55_000 }])], noGardens)).applied).toBe(1)
    expect(await variantPrices()).toEqual({ '100 g': 55_000, '250 g': 99_000 })

    // The seed file drops 100 g and adds 50 g: only the dropped seed size goes.
    await seedProducts([definition([{ size: '50 g', price: 30_000 }])], noGardens)
    expect(await variantPrices()).toEqual({ '50 g': 30_000, '250 g': 99_000 })
  })

  it('treats the first run after tracking began as a baseline, not a change', async () => {
    if (!available) return
    await adminEditPrice('50 g', 28_000)
    await db.delete(seedState).where(eq(seedState.key, `product:${slug}`))
    // Even a different definition is not applied when there is no record of the last one.
    expect((await seedProducts([definition([{ size: '50 g', price: 31_000 }])], noGardens)).applied).toBe(0)
    expect(await variantPrices()).toEqual({ '50 g': 28_000, '250 g': 99_000 })
    expect(await db.query.seedState.findFirst({ where: eq(seedState.key, `product:${slug}`) })).toBeTruthy()
  })
})
