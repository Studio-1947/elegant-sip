import { and, eq } from 'drizzle-orm'
import { db } from './db/client.js'
import { productVariants, products } from './db/schema.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Test teas.
 *
 * Tests that place orders need a tea that is on sale and cheap, and must not
 * depend on which real teas staff have retired. Each test file asks for its
 * own slug (other processes may test against the same database), gets a fresh
 * orderable tea with 20 of each size, and retires it again afterwards so it
 * never shows on the local shop or in a catalogue sync.
 * ──────────────────────────────────────────────────────────────────────────── */

export const TEST_TEA_SIZES = [
  { size: '100 g', price: 10_000 },
  { size: '200 g', price: 20_000 },
  { size: '500 g', price: 50_000 },
] as const

export async function provideTestTea(slug: string) {
  const [row] = await db
    .insert(products)
    .values({
      slug,
      name: `Test tea (${slug})`,
      status: 'active',
      description: 'Created by the automated tests. Never on sale.',
      imageSrc: '/products/first-flush.webp',
      category: 'Test',
      tastingNotes: [],
      sortOrder: 10_000,
    })
    .onConflictDoUpdate({ target: products.slug, set: { status: 'active', archivedAt: null } })
    .returning({ id: products.id })

  for (const [i, v] of TEST_TEA_SIZES.entries()) {
    await db
      .insert(productVariants)
      .values({ productId: row.id, size: v.size, sku: `${slug}--${i}`, price: v.price, stock: 20, sortOrder: i })
      .onConflictDoUpdate({
        target: [productVariants.productId, productVariants.size],
        set: { price: v.price, compareAtPrice: null, stock: 20 },
      })
  }
  return row.id
}

/** Takes the tea off the shop again. */
export const retireTestTea = (slug: string) =>
  db.update(products).set({ archivedAt: new Date() }).where(and(eq(products.slug, slug), eq(products.category, 'Test')))
