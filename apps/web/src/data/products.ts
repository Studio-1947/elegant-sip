/* ────────────────────────────────────────────────────────────────────────────
 * Catalogue — the build-time snapshot in catalogue.json, refreshed at runtime.
 *
 * The snapshot is pulled from the API by `npm run catalogue:sync`. It paints
 * the first frame and feeds the SEO prerender. Once the app is running,
 * `applyLiveCatalogue` overlays the live prices, stock and status and drops
 * retired teas, so a change staff make in the dashboard shows without a
 * deploy. PRODUCTS is updated in place, so every consumer keeps working with
 * the same export surface; components that cache derived lists subscribe to
 * `useCatalogue()` (lib/liveCatalogue.ts) to recompute.
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

/** Every product in the snapshot, retired ones included, so a tea brought back live keeps its full record. */
const SNAPSHOT_PRODUCTS = snapshot.products as Product[]

/** What the shop shows. Teas retired in the dashboard carry `archivedAt` and are left out. */
export const PRODUCTS: Product[] = SNAPSHOT_PRODUCTS.filter((p) => !p.archivedAt)

/* ── Live refresh ─────────────────────────────────────────────────────────── */

let current: readonly Product[] = [...PRODUCTS]
const listeners = new Set<() => void>()

/** The shop list as a new array each time live data is applied; for `useSyncExternalStore`. */
export const getCatalogueSnapshot = (): readonly Product[] => current

export function subscribeCatalogue(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Overlay the live catalogue (GET /v1/products) onto the snapshot, in place.
 *
 * Live order wins, teas missing from the live list (retired) drop out, and a
 * tea added since the last sync appears. For known teas everything staff can
 * edit in the dashboard is taken: text, photos, status, prices, stock and pack
 * sizes. Display only — the server re-prices every cart regardless.
 */
export function applyLiveCatalogue(live: readonly Product[]): void {
  const known = new Map(SNAPSHOT_PRODUCTS.map((p) => [p.slug, p]))
  const next = live
    .filter((fresh) => !fresh.archivedAt)
    .map((fresh) => {
      const shown = known.get(fresh.slug)
      if (!shown) return fresh
      shown.status = fresh.status
      // Words and photos edited in the admin product editor.
      Object.assign(shown, {
        name: fresh.name,
        description: fresh.description,
        longDescription: fresh.longDescription,
        imageSrc: fresh.imageSrc,
        images: fresh.images,
        category: fresh.category,
        tastingNotes: fresh.tastingNotes,
        bodyLevel: fresh.bodyLevel,
        harvestLabel: fresh.harvestLabel,
        origin: fresh.origin,
        flavorProfile: fresh.flavorProfile,
        brewingGuide: fresh.brewingGuide,
      })
      shown.fromPrice = fresh.fromPrice
      shown.archivedAt = null
      shown.variants = fresh.variants.map((v) => {
        const same = shown.variants.find((old) => old.size === v.size)
        return same ? Object.assign(same, { price: v.price, compareAtPrice: v.compareAtPrice, stock: v.stock }) : v
      })
      return shown
    })
  PRODUCTS.splice(0, PRODUCTS.length, ...next)
  current = [...PRODUCTS]
  listeners.forEach((listener) => listener())
}

/** Main photo first, then the gallery photos set in the admin, in order. */
export const getProductImages = (product: Product): string[] => [product.imageSrc, ...(product.images ?? [])]

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
