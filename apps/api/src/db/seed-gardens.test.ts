import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db, sql } from './client.js'
import { gardenProducts, gardens, products, seedState } from './schema.js'
import { NEW_RANGE } from './seed-new-range.js'
import { seedGardens, seedProducts, type GardenSeed, type ProductSeed } from './seed.js'

/* The boot seed must never undo garden edits or removed links made in the garden editor. */

const stamp = Date.now()
const gardenSlug = `seed-garden-${stamp}`
const productSlug = `seed-garden-tea-${stamp}`

const garden: GardenSeed = {
  slug: gardenSlug,
  name: 'Seed Garden',
  region: 'Seed Valley',
  elevation: '1,000 ft',
  imageSrc: '/origin.webp',
  story: ['Seed story.'],
}

const product = {
  ...NEW_RANGE[0],
  slug: productSlug,
  name: 'Seed Garden Tea',
  garden: gardenSlug,
  variants: [{ size: '100 g', price: 50_000, sku: `${productSlug}-100g`, compareAtPrice: 60_000, stock: 5 }],
} as unknown as ProductSeed

let available = true

const links = async () => {
  const row = await db.query.gardens.findFirst({ where: eq(gardens.slug, gardenSlug), with: { productLinks: true } })
  return row?.productLinks.length ?? 0
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
    await db.delete(products).where(eq(products.slug, productSlug))
    await db.delete(gardens).where(eq(gardens.slug, gardenSlug))
    await db
      .delete(seedState)
      .where(inArray(seedState.key, [`garden:${gardenSlug}`, `product:${productSlug}`, `garden-link:${productSlug}`]))
  }
  await sql.end({ timeout: 5 }).catch(() => {})
})

describe('boot seed — gardens', () => {
  it('creates a garden once and links its product', async () => {
    if (!available) return
    const { gardenIds, created } = await seedGardens([garden])
    expect(created).toBe(1)
    await seedProducts([product], gardenIds)
    expect(await links()).toBe(1)
  })

  it('keeps staff edits and removed links on the next boot', async () => {
    if (!available) return
    const row = await db.query.gardens.findFirst({ where: eq(gardens.slug, gardenSlug) })
    await db.update(gardens).set({ name: 'Edited Name', story: ['Edited story.'] }).where(eq(gardens.id, row!.id))
    await db.delete(gardenProducts).where(eq(gardenProducts.gardenId, row!.id))

    const { gardenIds, created } = await seedGardens([garden])
    expect(created).toBe(0)
    await seedProducts([product], gardenIds)

    const after = await db.query.gardens.findFirst({ where: eq(gardens.slug, gardenSlug) })
    expect(after).toMatchObject({ name: 'Edited Name', story: ['Edited story.'] })
    expect(await links()).toBe(0)
  })

  it('does not bring back a garden staff deleted', async () => {
    if (!available) return
    await db.delete(gardens).where(eq(gardens.slug, gardenSlug))
    const { gardenIds, created } = await seedGardens([garden])
    expect(created).toBe(0)
    expect(gardenIds.has(gardenSlug)).toBe(false)
    expect(await db.query.gardens.findFirst({ where: eq(gardens.slug, gardenSlug) })).toBeUndefined()
  })
})
