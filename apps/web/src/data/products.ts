/* ────────────────────────────────────────────────────────────────────────────
 * Catalogue — read from the build-time snapshot in catalogue.json.
 *
 * The snapshot is pulled from the API by `npm run catalogue:sync`. This module
 * keeps the same export surface the components already use, so the source of
 * the data changed without the shop, product pages or SEO pipeline changing
 * with it.
 *
 * MONEY IS PAISE HERE. The API speaks paise, so the snapshot does too, and
 * `formatINR` renders paise. Nothing in the storefront decides what a customer
 * pays — the server re-prices at /v1/pricing/quote and again at /v1/orders.
 * These figures are for display and routing only.
 * ──────────────────────────────────────────────────────────────────────────── */

import snapshot from './catalogue.json'
import type { Garden, JournalPost, Product, ProductVariant, Review } from '@elegantsip/shared'

export type { Garden, JournalPost, Product, ProductVariant, Review }

/** Legacy alias — the storefront called journal entries "articles". */
export type JournalArticle = JournalPost

export const CATALOGUE_SYNCED_AT: string = snapshot.syncedAt

/**
 * Products temporarily taken off the storefront (Nov 2026, while the new range
 * launches). They stay in the API and the snapshot; empty this list to bring
 * them back.
 */
const HIDDEN_PRODUCT_SLUGS = new Set([
  'first-flush-whole-leaf',
  'first-flush-broken-leaf',
  'first-flush-broken-mixed',
  'first-flush-fannings',
])

export const PRODUCTS: Product[] = (snapshot.products as Product[]).filter(
  (p) => !HIDDEN_PRODUCT_SLUGS.has(p.slug),
)

/** Extra photos beyond `imageSrc`, in display order. Not in the API yet. */
const EXTRA_IMAGES: Record<string, string[]> = {
  'first-flush': ['/products/first-flush-leaf.webp', '/products/first-flush-pile.webp'],
  'golden-needle': ['/products/golden-needle-alt.webp', '/products/golden-needle-leaf.webp', '/products/golden-needle-pile.webp'],
  'green-tea': ['/products/green-tea-alt.webp'],
  'pan-roasted': ['/products/pan-roasted-alt.webp', '/products/pan-roasted-leaf.webp', '/products/pan-roasted-pile.webp'],
  'silver-needle': ['/products/silver-needle-alt.webp', '/products/silver-needle-leaf.webp', '/products/silver-needle-pile.webp'],
  'white-tea': ['/products/white-tea-alt.webp'],
}

export const getProductImages = (product: Product): string[] => [
  product.imageSrc,
  ...(EXTRA_IMAGES[product.slug] ?? []),
]

/** Alt text for a product photo, read from its filename suffix. */
export const describeProductImage = (product: Product, src: string): string => {
  if (src.endsWith('-leaf.webp')) return `Close-up of ${product.name} dry tea leaves`
  if (src.endsWith('-pile.webp')) return `${product.name} loose leaf tea`
  return `${product.name} — loose-leaf Darjeeling tea in an Elegant Sip pack`
}
export const GARDENS: Garden[] = snapshot.gardens as Garden[]
export const JOURNAL: JournalPost[] = snapshot.journal as JournalPost[]

/* ── Product helpers ──────────────────────────────────────────────────────── */

export const getProduct = (slug: string | undefined): Product | undefined =>
  slug ? PRODUCTS.find((p) => p.slug === slug) : undefined

export const getVariant = (slug: string, size: string): ProductVariant | undefined =>
  getProduct(slug)?.variants.find((v) => v.size === size)

/** First purchasable variant, falling back to the first when all are sold out. */
export const getDefaultVariant = (product: Product): ProductVariant =>
  product.variants.find((v) => v.stock > 0) ?? product.variants[0]

export const isInStock = (product: Product): boolean =>
  product.status !== 'coming-soon' && product.variants.some((v) => v.stock > 0)

/** Lowest variant price in paise, or null for a product with no price yet. */
export const fromPrice = (product: Product): number | null => product.fromPrice

/* ── Gardens ──────────────────────────────────────────────────────────────── */

export const getGarden = (slug: string | undefined): Garden | undefined =>
  slug ? GARDENS.find((g) => g.slug === slug) : undefined

/**
 * The garden a product comes from.
 *
 * Resolved through the API's explicit product↔garden link rather than by
 * matching an estate name against a garden name — the audit found the old
 * string comparison silently resolved to nothing for every product.
 */
export const getGardenForProduct = (slug: string | undefined): Garden | undefined =>
  slug ? GARDENS.find((g) => g.productSlugs.includes(slug)) : undefined

/** Back-compat for callers that still pass an estate name. */
export const getGardenByEstate = (estate: string | undefined): Garden | undefined =>
  estate ? GARDENS.find((g) => g.name === estate) : undefined

/* ── Journal ──────────────────────────────────────────────────────────────── */

export const getArticle = (slug: string | undefined): JournalPost | undefined =>
  slug ? JOURNAL.find((a) => a.slug === slug) : undefined

/* ── Ratings ──────────────────────────────────────────────────────────────── */

/**
 * The rating carried in the snapshot, derived server-side from published
 * reviews. A product nobody has reviewed reports count 0 and the UI shows no
 * stars — never a default five.
 */
export const getRating = (slug: string | undefined): { average: number; count: number } =>
  getProduct(slug)?.rating ?? { average: 0, count: 0 }

/* ── Site content that has no backend home yet ────────────────────────────── */

export * from './content'
