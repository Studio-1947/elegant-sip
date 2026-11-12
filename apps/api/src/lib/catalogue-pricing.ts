import { productVariants, products } from '../db/schema.js'

/* ────────────────────────────────────────────────────────────────────────────
 * What a single pack costs, and whether it can be sold.
 *
 * Checkout (/v1/pricing/quote, and orders through it) and the Meta product
 * feed both read these rules, so the price an ad shows can never differ from
 * the price a customer is charged.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Columns every pricing decision needs, for a products ⋈ product_variants select. */
export const variantPricingColumns = {
  slug: products.slug,
  name: products.name,
  imageSrc: products.imageSrc,
  status: products.status,
  archivedAt: products.archivedAt,
  size: productVariants.size,
  sku: productVariants.sku,
  price: productVariants.price,
  compareAtPrice: productVariants.compareAtPrice,
  stock: productVariants.stock,
}

type PricingFields = {
  status: 'active' | 'coming-soon'
  price: number
  compareAtPrice: number | null
  stock: number
}

/** Paise charged for one pack. GST-inclusive; shipping is added per order. */
export const unitPrice = (v: Pick<PricingFields, 'price'>): number => v.price

/**
 * The regular price: the struck-out figure during an offer, otherwise the
 * price itself. Never lower than what is charged.
 */
export const regularPrice = (v: Pick<PricingFields, 'price' | 'compareAtPrice'>): number =>
  v.compareAtPrice !== null && v.compareAtPrice > v.price ? v.compareAtPrice : v.price

/** Why a pack cannot be ordered right now, or null when it can. A retired tea is never sold. */
export const unavailableReason = (
  v: Pick<PricingFields, 'status' | 'price' | 'stock'> & { archivedAt?: Date | null },
): 'retired' | 'coming-soon' | 'out-of-stock' | null => {
  if (v.archivedAt) return 'retired'
  if (v.status === 'coming-soon' || v.price <= 0) return 'coming-soon'
  if (v.stock <= 0) return 'out-of-stock'
  return null
}

/**
 * The pack a product page opens on: the first in-stock variant in catalogue
 * order, or the first variant when every one is sold out. Mirrors the
 * storefront's `getDefaultVariant`.
 */
export const defaultVariant = <V extends { stock: number }>(sorted: V[]): V | undefined =>
  sorted.find((v) => v.stock > 0) ?? sorted[0]
