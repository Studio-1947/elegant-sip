import type { Product } from '@elegantsip/shared'
import type { productVariants, products, reviews } from '../db/schema.js'
import type { InferSelectModel } from 'drizzle-orm'

type ProductRow = InferSelectModel<typeof products> & {
  variants: InferSelectModel<typeof productVariants>[]
  reviews: InferSelectModel<typeof reviews>[]
}

/**
 * Database row → API shape.
 *
 * Two pieces of domain logic live here rather than in the database, because
 * both are derived and would otherwise drift:
 *
 *  · `fromPrice` is the lowest variant price (the card's "from" figure), and
 *    is null for coming-soon products. A ₹0 price would render as "₹0" and
 *    read as free.
 *
 *  · `rating` counts only published reviews. An unreviewed product reports
 *    count 0, and the storefront renders no stars at all — the audit found it
 *    previously defaulted to a flat five, which asserted something untrue.
 */
export function toProductDto(row: ProductRow): Product {
  const comingSoon = row.status === 'coming-soon'
  const prices = row.variants.map((v) => v.price)

  const published = row.reviews.filter((r) => r.publishedAt !== null)
  const count = published.length
  const average =
    count === 0 ? 0 : Math.round((published.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    fromPrice: comingSoon || prices.length === 0 ? null : Math.min(...prices),
    description: row.description,
    longDescription: row.longDescription,
    imageSrc: row.imageSrc,
    category: row.category,
    tastingNotes: row.tastingNotes ?? [],
    bodyLevel: row.bodyLevel,
    harvestLabel: row.harvestLabel,
    variants: row.variants.map((v) => ({
      id: v.id,
      size: v.size,
      price: v.price,
      stock: v.stock,
      sku: v.sku,
    })),
    origin: row.origin ?? null,
    flavorProfile: row.flavorProfile ?? null,
    brewingGuide: row.brewingGuide ?? null,
    rating: { average, count },
  }
}
