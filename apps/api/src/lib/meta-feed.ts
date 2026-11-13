import { regularPrice, unavailableReason, unitPrice } from './catalogue-pricing.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Meta (Facebook/Instagram) product feed, as CSV.
 *
 * One row per product, for the pack the product page opens on. Prices come
 * from the same rules checkout uses (catalogue-pricing.ts): `price` is the
 * regular price and `sale_price` is what checkout charges, sent only when it
 * is lower. Products with no price yet (coming soon) are left out entirely.
 *
 * `id` is the pack's SKU; `item_group_id` is the product slug. The pixel and
 * Conversions API send slugs with content_type "product_group", which Meta
 * matches against item_group_id, so events and catalogue items line up.
 * ──────────────────────────────────────────────────────────────────────────── */

export const META_FEED_COLUMNS = [
  'id',
  'item_group_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'google_product_category',
  'product_type',
  'size',
] as const

const BRAND = 'Elegant Sip'
const GOOGLE_CATEGORY = 'Food, Beverages & Tobacco > Beverages > Tea & Infusions'

export type FeedProduct = {
  slug: string
  name: string
  status: 'active' | 'coming-soon'
  description: string
  longDescription: string | null
  imageSrc: string
  /** Extra photos, in display order. Meta accepts up to 20. */
  images: string[]
  category: string
  /** Already in catalogue order; the default pack is picked by the caller. */
  variant: { sku: string; size: string; price: number; compareAtPrice: number | null; stock: number }
}

/** Paise → "1148.00 INR". */
export const formatFeedPrice = (paise: number): string => `${(paise / 100).toFixed(2)} INR`

/** RFC 4180: quote a field when it holds a comma, quote or line break; double inner quotes. */
export const csvField = (value: string): string =>
  /[",\r\n]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value

const absolute = (siteUrl: string, path: string) => new URL(path, siteUrl).toString()

/**
 * A searchable title: "Elegant Sip Golden Needle Black Tea, 100 g Loose Leaf".
 * The category is left out when the name already says it ("Green Tea"), and
 * the brand when the name already starts with it.
 */
export function feedTitle(name: string, category: string, size: string): string {
  const lower = name.toLowerCase()
  const brand = lower.startsWith(BRAND.toLowerCase()) ? '' : `${BRAND} `
  const kind = lower.includes(category.toLowerCase()) ? '' : ` ${category}`
  return `${brand}${name}${kind}, ${size} Loose Leaf`
}

/** Feed rows for every sellable-or-sold-out product. Coming-soon products are skipped. */
export function metaFeedRows(items: FeedProduct[], siteUrl: string): Record<(typeof META_FEED_COLUMNS)[number], string>[] {
  return items
    .filter((p) => unavailableReason({ status: p.status, ...p.variant }) !== 'coming-soon')
    .map((p) => {
      const charged = unitPrice(p.variant)
      const regular = regularPrice(p.variant)
      const description = (p.longDescription ?? p.description).replace(/\s*\n\s*/g, ' ').trim()
      return {
        id: p.variant.sku,
        item_group_id: p.slug,
        title: feedTitle(p.name, p.category, p.variant.size),
        description,
        availability: p.variant.stock > 0 ? 'in stock' : 'out of stock',
        condition: 'new',
        price: formatFeedPrice(regular),
        sale_price: charged < regular ? formatFeedPrice(charged) : '',
        link: absolute(siteUrl, `/product/${p.slug}`),
        image_link: absolute(siteUrl, p.imageSrc),
        additional_image_link: p.images
          .slice(0, 20)
          .map((src) => absolute(siteUrl, src))
          .join(','),
        brand: BRAND,
        google_product_category: GOOGLE_CATEGORY,
        product_type: p.category,
        size: p.variant.size,
      }
    })
}

export function metaFeedCsv(items: FeedProduct[], siteUrl: string): string {
  const lines = [
    META_FEED_COLUMNS.join(','),
    ...metaFeedRows(items, siteUrl).map((row) => META_FEED_COLUMNS.map((c) => csvField(row[c])).join(',')),
  ]
  return lines.join('\n') + '\n'
}
