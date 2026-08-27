import { z } from 'zod'

/* ────────────────────────────────────────────────────────────────────────────
 * Catalogue schemas.
 *
 * These are the contract. The API validates responses against them, the
 * storefront derives its types from them, and @fastify/swagger turns them into
 * the OpenAPI document — so the docs cannot describe a shape the code does not
 * actually return.
 *
 * `.describe()` calls are not decoration: they become the field descriptions in
 * Swagger UI.
 * ──────────────────────────────────────────────────────────────────────────── */

export const slugSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase words separated by single hyphens')
  .describe('URL-safe identifier, e.g. "first-flush-whole-leaf"')

/** Money crosses the wire as integer paise. */
export const paiseSchema = z
  .number()
  .int()
  .nonnegative()
  .describe('Amount in paise (1 rupee = 100 paise)')

export const productStatusSchema = z
  .enum(['active', 'coming-soon'])
  .describe('Coming-soon products are listed but cannot be purchased and carry no price')

export const productVariantSchema = z.object({
  id: z.string().uuid(),
  size: z.string().describe('Display label, e.g. "Classic · 100 g"'),
  price: paiseSchema,
  stock: z.number().int().nonnegative().describe('Units available in the current lot'),
  sku: z.string(),
})

export const teaOriginSchema = z.object({
  origin: z.string().describe('e.g. "Darjeeling, West Bengal, India"'),
  estate: z.string().describe('Must match a garden name — the two are cross-linked'),
  elevation: z.string(),
  harvest: z.string(),
  cultivar: z.string(),
})

export const flavorProfileSchema = z.object({
  strength: z.number().int().min(1).max(5),
  astringency: z.number().int().min(1).max(5),
  sweetness: z.number().int().min(1).max(5),
  floral: z.number().int().min(1).max(5),
  caffeine: z.number().int().min(1).max(5),
})

export const brewingGuideSchema = z.object({
  temperature: z.string(),
  time: z.string(),
  steeps: z.string(),
  leafAmount: z.string(),
  notes: z.string(),
})

export const productSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  status: productStatusSchema,
  /** Lowest variant price — the card's "from" figure. Null when coming soon. */
  fromPrice: paiseSchema.nullable(),
  description: z.string(),
  longDescription: z.string().nullable(),
  imageSrc: z.string(),
  category: z.string(),
  tastingNotes: z.array(z.string()),
  bodyLevel: z.number().int().min(1).max(5).nullable(),
  harvestLabel: z.string().nullable(),
  variants: z.array(productVariantSchema),
  origin: teaOriginSchema.nullable(),
  flavorProfile: flavorProfileSchema.nullable(),
  brewingGuide: brewingGuideSchema.nullable(),
  rating: z
    .object({ average: z.number().min(0).max(5), count: z.number().int().nonnegative() })
    .describe('Derived from published reviews. count 0 means no stars are shown at all'),
})

export const gardenSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  region: z.string(),
  elevation: z.string(),
  imageSrc: z.string(),
  story: z.array(z.string()),
  productSlugs: z.array(slugSchema).describe('Products sourced from this garden'),
})

export const journalPostSchema = z.object({
  id: z.string().uuid(),
  slug: slugSchema,
  title: z.string(),
  excerpt: z.string(),
  category: z.string(),
  author: z.string(),
  publishedAt: z.iso.date().describe('ISO 8601 date — schema.org requires this format'),
  readTime: z.string(),
  imageSrc: z.string(),
  imageAlt: z.string(),
  body: z.array(z.string()),
})

export const reviewSchema = z.object({
  id: z.string().uuid(),
  author: z.string(),
  rating: z.number().int().min(1).max(5),
  text: z.string(),
  publishedAt: z.iso.datetime(),
  verified: z
    .boolean()
    .describe('True only when a paid order from this customer contains the product'),
})

export type Product = z.infer<typeof productSchema>
export type ProductVariant = z.infer<typeof productVariantSchema>
export type Garden = z.infer<typeof gardenSchema>
export type JournalPost = z.infer<typeof journalPostSchema>
export type Review = z.infer<typeof reviewSchema>
