import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { coupons, productVariants, products } from './schema.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Identity, orders and money.
 *
 * Same two conventions as the catalogue schema: money is integer paise, and
 * constraints do the enforcing so application bugs surface as loud violations
 * rather than quiet bad data.
 * ──────────────────────────────────────────────────────────────────────────── */

export const userRole = pgEnum('user_role', ['customer', 'admin'])

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Stored lowercased; the unique index is what prevents duplicates. */
    email: text('email').notNull().unique(),
    name: text('name').notNull(),
    /** Argon2id digest. */
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('customer'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_email_idx').on(t.email)],
)

export const tokenPurpose = pgEnum('token_purpose', ['email_verification', 'password_reset'])

/**
 * Single-use tokens. Only a SHA-256 hash is stored — a leaked database dump
 * must not hand anyone a working password-reset link.
 */
export const authTokens = pgTable(
  'auth_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    purpose: tokenPurpose('purpose').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auth_tokens_user_idx').on(t.userId)],
)

export const wishlistItems = pgTable(
  'wishlist_items',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('wishlist_items_pk').on(t.userId, t.productId)],
)

export const orderStatus = pgEnum('order_status', [
  'pending_payment',
  'paid',
  'packed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
])

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Customer-facing, e.g. ES-20260824-K3P9Q. */
    number: text('number').notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** SHA-256 of a 256-bit token returned only to a guest at checkout. */
    guestAccessTokenHash: text('guest_access_token_hash').unique(),
    /** Client-generated UUID that makes a checkout retry return the original order. */
    idempotencyKey: text('idempotency_key').unique(),
    status: orderStatus('status').notNull().default('pending_payment'),

    email: text('email').notNull(),
    shippingName: text('shipping_name').notNull(),
    shippingLine1: text('shipping_line1').notNull(),
    shippingCity: text('shipping_city').notNull(),
    shippingPostalCode: text('shipping_postal_code').notNull(),
    shippingState: text('shipping_state'),
    shippingCountry: text('shipping_country').notNull().default('India'),
    shippingPhone: text('shipping_phone'),

    /* Paise, snapshotted at purchase — never recomputed from a catalogue that
       may have changed since the order was placed. */
    subtotal: integer('subtotal').notNull(),
    discount: integer('discount').notNull().default(0),
    couponCode: text('coupon_code'),
    shippingMethod: text('shipping_method').notNull(),
    shippingFee: integer('shipping_fee').notNull(),
    tax: integer('tax').notNull(),
    total: integer('total').notNull(),

    notes: text('notes'),
    trackingNumber: text('tracking_number'),
    trackingCarrier: text('tracking_carrier'),

    placedAt: timestamp('placed_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  },
  (t) => [
    index('orders_user_idx').on(t.userId),
    index('orders_status_idx').on(t.status),
    index('orders_email_idx').on(t.email),
    check('orders_total_non_negative', sql`${t.total} >= 0`),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    /* Nulled rather than cascaded: the order must outlive catalogue changes. */
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'set null' }),
    productSlug: text('product_slug').notNull(),
    productName: text('product_name').notNull(),
    variantSize: text('variant_size').notNull(),
    sku: text('sku').notNull(),
    imageSrc: text('image_src').notNull(),
    unitPrice: integer('unit_price').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotal: integer('line_total').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
)

export const paymentStatus = pgEnum('payment_status', ['created', 'captured', 'failed', 'refunded'])

export const returnRequestType = pgEnum('return_request_type', ['cancellation', 'return'])
export const returnRequestStatus = pgEnum('return_request_status', ['requested', 'approved', 'rejected', 'received'])

/** Customer requests are operational records, separate from payment refunds. */
export const returnRequests = pgTable(
  'return_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }).unique(),
    type: returnRequestType('type').notNull(),
    status: returnRequestStatus('status').notNull().default('requested'),
    reason: text('reason').notNull(),
    staffNote: text('staff_note'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    receivedAt: timestamp('received_at', { withTimezone: true }),
  },
  (t) => [index('return_requests_status_idx').on(t.status), index('return_requests_order_idx').on(t.orderId)],
)

/** Reusable delivery addresses belong to an account, never to a browser. */
export const savedAddresses = pgTable(
  'saved_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    name: text('name').notNull(),
    line1: text('line1').notNull(),
    city: text('city').notNull(),
    postalCode: text('postal_code').notNull(),
    state: text('state'),
    country: text('country').notNull().default('India'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('saved_addresses_user_idx').on(t.userId)],
)

/** Append-only staff mutation log. Payloads are deliberately excluded to avoid storing secrets or customer PII twice. */
export const adminAuditEvents = pgTable(
  'admin_audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    action: text('action').notNull(),
    resource: text('resource').notNull(),
    statusCode: integer('status_code').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('admin_audit_events_actor_idx').on(t.actorId), index('admin_audit_events_occurred_idx').on(t.occurredAt)],
)

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('razorpay'),
    providerOrderId: text('provider_order_id').notNull(),
    providerPaymentId: text('provider_payment_id'),
    status: paymentStatus('status').notNull().default('created'),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('INR'),
    method: text('method'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
  },
  (t) => [
    unique('payments_provider_order_key').on(t.provider, t.providerOrderId),
    index('payments_order_idx').on(t.orderId),
  ],
)

/**
 * Every gateway webhook, recorded before it is acted on.
 *
 * The unique constraint on the provider's event id IS the idempotency
 * mechanism. Razorpay retries by design, and a duplicate delivery must never
 * capture an order twice.
 */
export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('webhook_events_provider_event_key').on(t.provider, t.eventId)],
)

export const stockReason = pgEnum('stock_reason', [
  'seed',
  'order_reserved',
  'order_released',
  'order_fulfilled',
  'manual_adjustment',
  'restock',
])

/**
 * Append-only stock movements. The variant's stock column carries the running
 * total; this is the audit trail that answers "where did twelve packs go".
 */
export const stockLedger = pgTable(
  'stock_ledger',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    /** Negative removes stock, positive returns it. */
    delta: integer('delta').notNull(),
    reason: stockReason('reason').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stock_ledger_variant_idx').on(t.variantId),
    index('stock_ledger_order_idx').on(t.orderId),
  ],
)

export const couponRedemptions = pgTable(
  'coupon_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    couponId: uuid('coupon_id')
      .notNull()
      .references(() => coupons.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('coupon_redemptions_order_key').on(t.couponId, t.orderId)],
)

/**
 * GST invoices. `sequence` is per financial year and must never be reused —
 * Indian tax law requires an unbroken series.
 */
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'restrict' })
      .unique(),
    /** e.g. ES/2026-27/0001 */
    number: text('number').notNull().unique(),
    financialYear: text('financial_year').notNull(),
    sequence: integer('sequence').notNull(),
    sellerGstin: text('seller_gstin'),
    placeOfSupply: text('place_of_supply').notNull(),
    /* Intra-state splits into CGST+SGST; inter-state is a single IGST line.
       Same 5% either way — different lines on a legal document. */
    isIntraState: boolean('is_intra_state').notNull(),
    cgst: integer('cgst').notNull().default(0),
    sgst: integer('sgst').notNull().default(0),
    igst: integer('igst').notNull().default(0),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('invoices_year_sequence_key').on(t.financialYear, t.sequence)],
)

export const newsletterSubscribers = pgTable('newsletter_subscribers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/* ── Relations ────────────────────────────────────────────────────────────── */

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  wishlist: many(wishlistItems),
  savedAddresses: many(savedAddresses),
  adminAuditEvents: many(adminAuditEvents),
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  payments: many(payments),
  invoice: one(invoices, { fields: [orders.id], references: [invoices.orderId] }),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}))

export const returnRequestsRelations = relations(returnRequests, ({ one }) => ({
  order: one(orders, { fields: [returnRequests.orderId], references: [orders.id] }),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  order: one(orders, { fields: [invoices.orderId], references: [orders.id] }),
}))

export const wishlistItemsRelations = relations(wishlistItems, ({ one }) => ({
  user: one(users, { fields: [wishlistItems.userId], references: [users.id] }),
  product: one(products, { fields: [wishlistItems.productId], references: [products.id] }),
}))

export const savedAddressesRelations = relations(savedAddresses, ({ one }) => ({
  user: one(users, { fields: [savedAddresses.userId], references: [users.id] }),
}))

export const adminAuditEventsRelations = relations(adminAuditEvents, ({ one }) => ({
  actor: one(users, { fields: [adminAuditEvents.actorId], references: [users.id] }),
}))
