import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

/* ────────────────────────────────────────────────────────────────────────────
 * Schema — phase 01: the catalogue.
 *
 * Two conventions used throughout:
 *
 *  1. MONEY IS INTEGER PAISE. Never numeric, never float. Postgres `integer`
 *     tops out around ₹21 crore which is far beyond any single order here.
 *
 *  2. CONSTRAINTS DO THE ENFORCING. A price cannot be negative because the
 *     database refuses it, not because every code path remembers to check.
 *     Application bugs then surface as loud constraint violations instead of
 *     quiet bad data.
 * ──────────────────────────────────────────────────────────────────────────── */

export const productStatus = pgEnum('product_status', ['active', 'coming-soon'])

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    status: productStatus('status').notNull().default('active'),
    description: text('description').notNull(),
    longDescription: text('long_description'),
    imageSrc: text('image_src').notNull(),
    category: text('category').notNull(),
    tastingNotes: jsonb('tasting_notes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    bodyLevel: smallint('body_level'),
    harvestLabel: text('harvest_label'),
    /** Structured blocks kept as JSONB — read whole, never queried by field. */
    origin: jsonb('origin').$type<{
      origin: string
      estate: string
      elevation: string
      harvest: string
      cultivar: string
    } | null>(),
    flavorProfile: jsonb('flavor_profile').$type<{
      strength: number
      astringency: number
      sweetness: number
      floral: number
      caffeine: number
    } | null>(),
    brewingGuide: jsonb('brewing_guide').$type<{
      temperature: string
      time: string
      steeps: string
      leafAmount: string
      notes: string
    } | null>(),
    /** Catalogue order for the shop grid — deliberately not alphabetical. */
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('products_status_idx').on(t.status),
    index('products_sort_idx').on(t.sortOrder),
    check('products_body_level_range', sql`${t.bodyLevel} IS NULL OR (${t.bodyLevel} BETWEEN 1 AND 5)`),
  ],
)

export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Display label, e.g. "Premium · 100 g". */
    size: text('size').notNull(),
    sku: text('sku').notNull().unique(),
    /** Paise. */
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('product_variants_product_size_key').on(t.productId, t.size),
    index('product_variants_product_idx').on(t.productId),
    // Stock can never be driven below zero, whatever the application does.
    check('product_variants_stock_non_negative', sql`${t.stock} >= 0`),
    check('product_variants_price_non_negative', sql`${t.price} >= 0`),
  ],
)

export const gardens = pgTable('gardens', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  region: text('region').notNull(),
  elevation: text('elevation').notNull(),
  imageSrc: text('image_src').notNull(),
  story: jsonb('story').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Garden ↔ product link.
 *
 * Explicit join table rather than a string `estate` field on the product. The
 * audit found that the previous string-matching arrangement silently resolved
 * to nothing — a foreign key cannot fail that way.
 */
export const gardenProducts = pgTable(
  'garden_products',
  {
    gardenId: uuid('garden_id')
      .notNull()
      .references(() => gardens.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
  },
  (t) => [
    unique('garden_products_pk').on(t.gardenId, t.productId),
    index('garden_products_product_idx').on(t.productId),
  ],
)

export const journalPosts = pgTable(
  'journal_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull(),
    category: text('category').notNull(),
    author: text('author').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    readTime: text('read_time').notNull(),
    imageSrc: text('image_src').notNull(),
    imageAlt: text('image_alt').notNull(),
    body: jsonb('body').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('journal_published_idx').on(t.publishedAt)],
)

/**
 * Reviews.
 *
 * `verified` is written by the server from order history and is never accepted
 * from a request. `publishedAt` being null means awaiting moderation — nothing
 * reaches the storefront until it is set.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /* Who wrote it. Nullable only so the seed reviews of a pre-account era
       could be retained; every new review carries one. */
    userId: uuid('user_id'),
    authorName: text('author_name').notNull(),
    rating: smallint('rating').notNull(),
    body: text('body').notNull(),
    verified: boolean('verified').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('reviews_product_idx').on(t.productId),
    // One review per customer per product — keyed on identity, not on a
    // display name two different people could share.
    unique('reviews_product_user_key').on(t.productId, t.userId),
    check('reviews_rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
  ],
)

export const coupons = pgTable(
  'coupons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    percentOff: integer('percent_off').notNull(),
    /** Paise. Null = no minimum. */
    minSubtotal: integer('min_subtotal'),
    active: boolean('active').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    /** Null = unlimited. */
    maxRedemptions: integer('max_redemptions'),
    redemptionCount: integer('redemption_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('coupons_percent_range', sql`${t.percentOff} BETWEEN 1 AND 100`)],
)

/* ── Relations ────────────────────────────────────────────────────────────── */

export const productsRelations = relations(products, ({ many }) => ({
  variants: many(productVariants),
  reviews: many(reviews),
  gardenLinks: many(gardenProducts),
}))

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}))

export const gardensRelations = relations(gardens, ({ many }) => ({
  productLinks: many(gardenProducts),
}))

export const gardenProductsRelations = relations(gardenProducts, ({ one }) => ({
  garden: one(gardens, { fields: [gardenProducts.gardenId], references: [gardens.id] }),
  product: one(products, { fields: [gardenProducts.productId], references: [products.id] }),
}))

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
}))
