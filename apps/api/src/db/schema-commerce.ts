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
    phone: text('phone').unique(),
    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    /** TOTP secret for two-step sign-in, encrypted with MFA_ENCRYPTION_KEY. Set during enrolment, before it is confirmed. */
    mfaSecret: text('mfa_secret'),
    /** Two-step sign-in is on only once a code from the authenticator app has been confirmed. */
    mfaEnabledAt: timestamp('mfa_enabled_at', { withTimezone: true }),
    /** SHA-256 digests of unused one-time recovery codes. */
    mfaRecoveryCodes: jsonb('mfa_recovery_codes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('users_email_idx').on(t.email)],
)

export const tokenPurpose = pgEnum('token_purpose', ['email_verification', 'password_reset'])
export const otpPurpose = pgEnum('otp_purpose', ['phone_login', 'phone_link'])

/** Short-lived, single-use WhatsApp codes. Only Argon2 hashes are retained. */
export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    purpose: otpPurpose('purpose').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Per-number rate limits count recent challenges by phone and age; this
    // index also serves plain phone lookups, so it replaces the phone-only one.
    index('otp_challenges_phone_created_idx').on(t.phone, t.createdAt),
    index('otp_challenges_user_idx').on(t.userId),
  ],
)

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
    /* Billing is immutable order data, never a reference to an editable address-book row. */
    billingName: text('billing_name'),
    billingLine1: text('billing_line1'),
    billingCity: text('billing_city'),
    billingPostalCode: text('billing_postal_code'),
    billingState: text('billing_state'),
    billingCountry: text('billing_country'),
    billingPhone: text('billing_phone'),

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
    /*
     * Meta Conversions API. Recorded only when the customer had accepted
     * cookies at checkout, so the payment webhook can report the purchase even
     * if they never return to the site. Meta's own cookie IDs, nothing else.
     */
    adConsent: boolean('ad_consent').notNull().default(false),
    metaFbp: text('meta_fbp'),
    metaFbc: text('meta_fbc'),
    /** Meta needs the buyer's IP and browser for website events. Cleared once the purchase is reported. */
    metaClientIp: text('meta_client_ip'),
    metaClientUa: text('meta_client_ua'),
    /** Set once the server has reported this purchase to Meta, so it is reported once. */
    metaPurchaseSentAt: timestamp('meta_purchase_sent_at', { withTimezone: true }),
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
    /** One address may be the customer's default for either or both checkout roles. */
    isDefaultShipping: boolean('is_default_shipping').notNull().default(false),
    isDefaultBilling: boolean('is_default_billing').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('saved_addresses_user_idx').on(t.userId)],
)

/*
 * Shop-wide switches staff change from the admin page. Exactly one row (id 1),
 * created by the migration.
 */
export const storeSettings = pgTable(
  'store_settings',
  {
    id: integer('id').primaryKey().default(1),
    /** Lets customers check out without an account (the API already supports guest orders). */
    guestCheckoutEnabled: boolean('guest_checkout_enabled').notNull().default(false),
    /** Shows the satisfaction guarantee on product pages, trust badges and policies. */
    guaranteeEnabled: boolean('guarantee_enabled').notNull().default(true),
    guaranteeDays: integer('guarantee_days').notNull().default(30),
    /** Staff are emailed when a pack on sale falls to this many or fewer. */
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (t) => [
    check('store_settings_single_row', sql`${t.id} = 1`),
    check('store_settings_guarantee_days', sql`${t.guaranteeDays} BETWEEN 1 AND 365`),
    check('store_settings_low_stock_threshold', sql`${t.lowStockThreshold} BETWEEN 0 AND 1000`),
  ],
)

export const refundStatus = pgEnum('refund_status', ['pending', 'processed', 'failed'])

/** Money returned to a customer through the payment gateway. An order may have several (partial) refunds. */
export const refunds = pgTable(
  'refunds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'restrict' }),
    paymentId: uuid('payment_id').notNull().references(() => payments.id, { onDelete: 'restrict' }),
    /** Client-generated, so a double-clicked refund is issued once. */
    idempotencyKey: text('idempotency_key').notNull().unique(),
    providerRefundId: text('provider_refund_id').unique(),
    /** Paise. */
    amount: integer('amount').notNull(),
    status: refundStatus('status').notNull().default('pending'),
    reason: text('reason').notNull(),
    failureReason: text('failure_reason'),
    requestedBy: uuid('requested_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    index('refunds_order_idx').on(t.orderId),
    check('refunds_amount_positive', sql`${t.amount} > 0`),
  ],
)

export const emailStatus = pgEnum('email_status', ['pending', 'sent', 'failed'])

/**
 * Outgoing email that could not be delivered on the first try, kept for a
 * retry. A message that keeps failing ends as `failed` and staff are alerted.
 */
export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** What kind of message, e.g. "order_confirmation", for logs and the admin page. */
    kind: text('kind').notNull(),
    to: text('to').notNull(),
    subject: text('subject').notNull(),
    html: text('html').notNull(),
    text: text('text').notNull(),
    replyTo: text('reply_to'),
    status: emailStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [index('email_outbox_due_idx').on(t.status, t.nextAttemptAt)],
)

/** Contact-form messages, each with a reference the customer can quote. */
export const contactMessages = pgTable(
  'contact_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Customer-facing, e.g. ES-C-7K3P9Q. */
    reference: text('reference').notNull().unique(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    subject: text('subject').notNull(),
    message: text('message').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('contact_messages_created_idx').on(t.createdAt)],
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

/** One courier scan, newest last. Stored as the provider reported it, minus noise. */
export interface ShipmentEvent {
  at: string
  status: string
  location: string | null
  detail: string | null
}

/**
 * The courier side of an order. One row per order: cancelling a shipment keeps
 * the row (status `cancelled`) and creating a new one reuses it, so history of
 * what the courier saw is never split across rows.
 *
 * `status` is our normalised state; `providerStatus` is the courier's own text
 * (e.g. "REACHED AT DESTINATION HUB"), kept for staff who need the detail.
 */
export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' })
      .unique(),
    provider: text('provider').notNull(),
    providerOrderId: text('provider_order_id'),
    providerShipmentId: text('provider_shipment_id'),
    awb: text('awb'),
    courierId: integer('courier_id'),
    courierName: text('courier_name'),
    status: text('status').notNull().default('created'),
    providerStatus: text('provider_status'),
    weightGrams: integer('weight_grams').notNull(),
    labelUrl: text('label_url'),
    trackingUrl: text('tracking_url'),
    pickupScheduledAt: timestamp('pickup_scheduled_at', { withTimezone: true }),
    expectedDeliveryAt: timestamp('expected_delivery_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    /** The last step that failed, so staff can see why a shipment is stuck. */
    lastError: text('last_error'),
    events: jsonb('events').$type<ShipmentEvent[]>().notNull().default([]),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    /**
     * Fresh bookings of this order with the courier (1 = the first). Shiprocket
     * needs a new order_id for each, so attempts after the first are suffixed.
     */
    bookingAttempt: integer('booking_attempt').notNull().default(0),
    /** Lease held while a booking or cancellation talks to the courier; stale after a few minutes. */
    bookingStartedAt: timestamp('booking_started_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipments_awb_idx').on(t.awb), index('shipments_status_idx').on(t.status)],
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
  shipment: one(shipments, { fields: [orders.id], references: [shipments.orderId] }),
}))

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
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
