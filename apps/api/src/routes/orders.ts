import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
  COUPONS_ENABLED,
  TAX_RATE,
  calculatePricing,
  cartLineInputSchema,
  couponDiscount,
  formatPaise,
  paiseSchema,
  problemSchema,
  shippingMethodIdSchema,
  slugSchema,
} from '@elegantsip/shared'
import { db } from '../db/client.js'
import { coupons, productVariants, products } from '../db/schema.js'
import {
  couponRedemptions,
  orderItems,
  orders,
  payments,
  returnRequests,
  shipments,
  stockLedger,
} from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { getGateway } from '../lib/gateway.js'
import { capturePayment } from '../lib/capture.js'
import { sendEmail } from '../lib/email.js'
import { env, paymentsEnabled } from '../env.js'
import { getInvoiceView } from '../lib/invoice.js'
import { customerRefunds } from '../lib/refunds.js'
import { checkLowStock } from '../lib/low-stock.js'
import { checkoutAdDetails } from '../lib/meta-purchase.js'
import { getStoreSettings } from '../lib/settings.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Orders.
 *
 * The single most important property of this file: an order is priced from the
 * catalogue inside a database transaction that also reserves stock. Nothing
 * monetary is taken from the request.
 *
 * Concurrency is handled by locking the variant rows with SELECT … FOR UPDATE
 * before reading their stock. Two customers racing for the last pack serialise
 * on that lock, so exactly one of them gets it — rather than both reading
 * "1 remaining" and both succeeding.
 *
 * The order is created as `pending_payment`. It only becomes `paid` when a
 * signed webhook says so; see webhooks.ts. The browser's return trip is not
 * evidence of anything.
 * ──────────────────────────────────────────────────────────────────────────── */

const addressSchema = z.object({
  name: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(4).max(200),
  city: z.string().trim().min(2).max(80),
  postalCode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code'),
  state: z.string().trim().max(80).optional(),
  country: z.literal('India').default('India'),
  phone: z.string().trim().max(20).optional(),
})

const orderItemDto = z.object({
  productSlug: slugSchema,
  productName: z.string(),
  variantSize: z.string(),
  imageSrc: z.string(),
  quantity: z.number().int(),
  unitPrice: paiseSchema,
  lineTotal: paiseSchema,
})

const orderDto = z.object({
  number: z.string(),
  status: z.enum(['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  placedAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  email: z.string(),
  items: z.array(orderItemDto),
  subtotal: paiseSchema,
  discount: paiseSchema,
  couponCode: z.string().nullable(),
  shippingMethod: z.string(),
  shippingFee: paiseSchema,
  tax: paiseSchema,
  total: paiseSchema,
  shipping: z.object({
    name: z.string(),
    line1: z.string(),
    city: z.string(),
    postalCode: z.string(),
    state: z.string().nullable(),
    country: z.string(),
  }),
  billing: z.object({
    name: z.string(),
    line1: z.string(),
    city: z.string(),
    postalCode: z.string(),
    state: z.string().nullable(),
    country: z.string(),
  }),
  tracking: z
    .object({ carrier: z.string().nullable(), number: z.string().nullable() })
    .nullable(),
  /** Live courier tracking. Null until a courier is booked, and after it is cancelled. */
  shipment: z
    .object({
      status: z.string(),
      courierName: z.string().nullable(),
      awb: z.string().nullable(),
      trackingUrl: z.string().nullable(),
      expectedDeliveryAt: z.string().nullable(),
      deliveredAt: z.string().nullable(),
      events: z.array(z.object({ at: z.string(), status: z.string(), location: z.string().nullable() })),
    })
    .nullable(),
  /** Single-order view only. `requested` is asked of the gateway, not yet confirmed; failed attempts are not shown. */
  refunds: z
    .array(z.object({ amount: paiseSchema, status: z.enum(['requested', 'processed']), requestedAt: z.iso.datetime(), processedAt: z.iso.datetime().nullable() }))
    .optional(),
})

/**
 * True only when a guest order's stored token hash matches a supplied token.
 * Both sides must be present: an order whose account was deleted has a null
 * user AND a null hash, and `null === null` must never grant access to it.
 */
export function guestAccessMatches(
  order: { userId: string | null; guestAccessTokenHash: string | null },
  token: unknown,
): boolean {
  if (order.userId !== null || !order.guestAccessTokenHash || typeof token !== 'string' || !token) return false
  return createHash('sha256').update(token).digest('hex') === order.guestAccessTokenHash
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Puts an order's reserved stock back on the shelf and frees its coupon use.
 * Runs inside the caller's transaction, after the caller has moved the order
 * out of its holding state, so a release can never happen twice.
 */
export async function releaseOrderHoldings(tx: Tx, orderId: string, note: string): Promise<void> {
  const lines = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const line of lines) {
    if (!line.variantId) continue
    await tx
      .update(productVariants)
      .set({ stock: sql`${productVariants.stock} + ${line.quantity}` })
      .where(eq(productVariants.id, line.variantId))
    await tx.insert(stockLedger).values({
      variantId: line.variantId,
      orderId,
      delta: line.quantity,
      reason: 'order_released',
      note,
    })
  }
  const redeemed = await tx
    .delete(couponRedemptions)
    .where(eq(couponRedemptions.orderId, orderId))
    .returning({ couponId: couponRedemptions.couponId })
  for (const { couponId } of redeemed) {
    await tx
      .update(coupons)
      .set({ redemptionCount: sql`GREATEST(${coupons.redemptionCount} - 1, 0)` })
      .where(eq(coupons.id, couponId))
  }
}

/** ES-20260824-K3P9Q — date-prefixed and random, so it cannot collide. */
function generateOrderNumber(): string {
  const d = new Date()
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return `ES-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`
}

type OrderRow = typeof orders.$inferSelect & {
  items: (typeof orderItems.$inferSelect)[]
  shipment?: typeof shipments.$inferSelect | null
}

const toOrderDto = (row: OrderRow) => ({
  number: row.number,
  status: row.status,
  placedAt: row.placedAt.toISOString(),
  paidAt: row.paidAt?.toISOString() ?? null,
  shippedAt: row.shippedAt?.toISOString() ?? null,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  email: row.email,
  items: row.items.map((i) => ({
    productSlug: i.productSlug,
    productName: i.productName,
    variantSize: i.variantSize,
    imageSrc: i.imageSrc,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
  })),
  subtotal: row.subtotal,
  discount: row.discount,
  couponCode: row.couponCode,
  shippingMethod: row.shippingMethod,
  shippingFee: row.shippingFee,
  tax: row.tax,
  total: row.total,
  shipping: {
    name: row.shippingName,
    line1: row.shippingLine1,
    city: row.shippingCity,
    postalCode: row.shippingPostalCode,
    state: row.shippingState,
    country: row.shippingCountry,
  },
  billing: {
    name: row.billingName ?? row.shippingName,
    line1: row.billingLine1 ?? row.shippingLine1,
    city: row.billingCity ?? row.shippingCity,
    postalCode: row.billingPostalCode ?? row.shippingPostalCode,
    state: row.billingState ?? row.shippingState,
    country: row.billingCountry ?? row.shippingCountry,
  },
  tracking:
    row.trackingNumber || row.trackingCarrier
      ? { carrier: row.trackingCarrier, number: row.trackingNumber }
      : null,
  // A cancelled or refunded order shows no parcel, even one still returning to us.
  shipment:
    row.shipment && row.shipment.status !== 'cancelled' && row.shipment.awb && !['cancelled', 'refunded'].includes(row.status)
      ? {
          status: row.shipment.status,
          courierName: row.shipment.courierName,
          awb: row.shipment.awb,
          trackingUrl: row.shipment.trackingUrl,
          expectedDeliveryAt: row.shipment.expectedDeliveryAt?.toISOString() ?? null,
          deliveredAt: row.shipment.deliveredAt?.toISOString() ?? null,
          // Customers see where the parcel has been, not the courier's internal notes.
          events: row.shipment.events.map(({ at, status, location }) => ({ at, status, location })),
        }
      : null,
})

/** Returns a previous checkout only to the same account or token-holding guest. */
async function idempotentOrderResult(input: {
  key: string
  userId: string | null
  guestAccessToken: string | undefined
}) {
  const row = await db.query.orders.findFirst({
    where: eq(orders.idempotencyKey, input.key),
    with: { items: true, payments: true },
  })
  if (!row) return null

  const allowed =
    (row.userId !== null && row.userId === input.userId) || guestAccessMatches(row, input.guestAccessToken)
  if (!allowed) throw new ApiError(409, 'idempotency_conflict', 'Checkout conflict', 'This checkout key cannot be reused.')

  const payment = row.payments.find((p) => p.status === 'created') ?? row.payments[0]
  if (!payment) throw new ApiError(409, 'idempotency_conflict', 'Checkout conflict', 'The original checkout has no payment record.')

  return {
    order: toOrderDto(row),
    payment: {
      provider: payment.provider,
      gatewayOrderId: payment.providerOrderId,
      amount: payment.amount,
      currency: payment.currency,
      publicKey: payment.provider === 'razorpay' ? (env.RAZORPAY_KEY_ID ?? '') : 'rzp_test_fake',
    },
    guestAccessToken: row.userId === null ? input.guestAccessToken ?? null : null,
  }
}

export const orderRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/orders',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'Place an order',
        description: [
          'Re-prices the cart from the catalogue, reserves stock and creates a gateway order,',
          'all in one database transaction. If any part fails, none of it happened.',
          '',
          'The order is created as `pending_payment` and returns the gateway handle the browser',
          'checkout widget needs. **It is not a paid order** — only a signed webhook makes it one.',
          '',
          'No prices are accepted in the request.',
        ].join('\n'),
        body: z.object({
          items: z.array(cartLineInputSchema).min(1).max(50),
          email: z
            .string()
            .trim()
            .toLowerCase()
            .email()
            .refine((value) => !value.endsWith('.invalid'), 'Enter the email address where you want order updates.'),
          shipping: addressSchema,
          billing: addressSchema.optional(),
          shippingMethod: shippingMethodIdSchema.default('standard'),
          couponCode: z.string().trim().toUpperCase().max(32).optional(),
          notes: z.string().trim().max(500).optional(),
          /** The customer accepted cookies; lets the payment webhook report the purchase to Meta. */
          adConsent: z.boolean().optional(),
        }),
        headers: z
          .object({
            'idempotency-key': z.string().uuid().optional(),
            'x-guest-access-token': z.string().min(40).max(100).optional(),
          })
          .passthrough(),
        response: {
          200: z.object({
            order: orderDto,
            payment: z.object({
              provider: z.string(),
              gatewayOrderId: z.string(),
              amount: paiseSchema,
              currency: z.string(),
              publicKey: z.string(),
            }),
            guestAccessToken: z.string().nullable(),
          }),
          400: problemSchema,
          401: problemSchema,
          409: problemSchema,
          502: problemSchema,
        },
      },
    },
    async (request) => {
      if (!paymentsEnabled) {
        throw new ApiError(503, 'payments_unavailable', 'Checkout unavailable', 'Online checkout will be available soon. Please check back shortly.')
      }
      const { items, email, shipping, billing = shipping, shippingMethod, couponCode, notes, adConsent } = request.body
      // Guests may check out only while staff have guest checkout switched on.
      if (!request.session && !(await getStoreSettings()).guestCheckoutEnabled) {
        throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in before checking out.')
      }
      const userId = request.session?.userId ?? null
      const idempotencyKey = request.headers['idempotency-key']
      const guestTokenHeader = request.headers['x-guest-access-token']
      const suppliedGuestAccessToken = typeof guestTokenHeader === 'string' ? guestTokenHeader : undefined
      if (typeof idempotencyKey === 'string') {
        const prior = await idempotentOrderResult({ key: idempotencyKey, userId, guestAccessToken: suppliedGuestAccessToken })
        if (prior) return prior
      }

      /* A guest reads the order back with this token, never by order number
         alone. A retry reuses the browser's token so the same link keeps working. */
      const guestAccessToken = userId ? null : suppliedGuestAccessToken ?? randomBytes(32).toString('base64url')
      const guestAccessTokenHash = guestAccessToken ? createHash('sha256').update(guestAccessToken).digest('hex') : null

      const result = await db.transaction(async (tx) => {
        /* Lock the variant rows before reading stock. Ordered by id so two
           concurrent orders acquire locks in the same sequence and cannot
           deadlock against each other. */
        const slugs = items.map((i) => i.productSlug)
        const locked = await tx
          .select({
            variantId: productVariants.id,
            size: productVariants.size,
            price: productVariants.price,
            stock: productVariants.stock,
            sku: productVariants.sku,
            productId: products.id,
            slug: products.slug,
            name: products.name,
            imageSrc: products.imageSrc,
            status: products.status,
            archivedAt: products.archivedAt,
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(inArray(products.slug, slugs))
          .orderBy(productVariants.id)
          .for('update')

        const priced: {
          variantId: string
          productSlug: string
          productName: string
          variantSize: string
          sku: string
          imageSrc: string
          unitPrice: number
          quantity: number
          lineTotal: number
        }[] = []

        for (const line of items) {
          const v = locked.find((r) => r.slug === line.productSlug && r.size === line.variantSize)
          if (!v) {
            throw ApiError.badRequest(
              `"${line.productSlug}" (${line.variantSize}) is no longer available. Please review your cart.`,
            )
          }
          if (v.archivedAt) {
            throw ApiError.conflict('product_retired', `${v.name} is no longer sold. Please remove it from your cart.`)
          }
          if (v.status === 'coming-soon') {
            throw ApiError.badRequest(`${v.name} has not been released yet and cannot be ordered.`)
          }
          if (v.stock < line.quantity) {
            throw ApiError.conflict(
              'out_of_stock',
              v.stock === 0
                ? `${v.name} (${v.size}) sold out while you were checking out.`
                : `Only ${v.stock} of ${v.name} (${v.size}) remain. Please reduce the quantity and try again.`,
            )
          }
          priced.push({
            variantId: v.variantId,
            productSlug: v.slug,
            productName: v.name,
            variantSize: v.size,
            sku: v.sku,
            imageSrc: v.imageSrc,
            unitPrice: v.price,
            quantity: line.quantity,
            lineTotal: v.price * line.quantity,
          })
        }

        const subtotal = priced.reduce((a, l) => a + l.lineTotal, 0)

        /* Coupon, re-validated server-side. A code that has since expired or
           been fully redeemed simply does not apply. */
        let discount = 0
        let appliedCoupon: { id: string; code: string } | null = null
        // Coupons are off during the 25% launch offer (25% max discount per order).
        if (couponCode && COUPONS_ENABLED) {
          // Locked so two checkouts cannot both take the last redemption of a limited code.
          const [c] = await tx.select().from(coupons).where(eq(coupons.code, couponCode)).for('update')
          const usable =
            c &&
            c.active &&
            (!c.expiresAt || c.expiresAt.getTime() > Date.now()) &&
            (c.maxRedemptions === null || c.redemptionCount < c.maxRedemptions)
          if (usable) {
            discount = couponDiscount(
              { code: c.code, percentOff: c.percentOff / 100, minSubtotal: c.minSubtotal ?? undefined },
              subtotal,
            )
            if (discount > 0) appliedCoupon = { id: c.id, code: c.code }
          }
        }

        const pricing = calculatePricing({ subtotal, discount, shippingMethod })
        const number = generateOrderNumber()

        const [order] = await tx
          .insert(orders)
          .values({
            number,
            userId,
            guestAccessTokenHash,
            idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : null,
            email,
            shippingName: shipping.name,
            shippingLine1: shipping.line1,
            shippingCity: shipping.city,
            shippingPostalCode: shipping.postalCode,
            shippingState: shipping.state ?? null,
            shippingCountry: shipping.country,
            shippingPhone: shipping.phone ?? null,
            billingName: billing.name,
            billingLine1: billing.line1,
            billingCity: billing.city,
            billingPostalCode: billing.postalCode,
            billingState: billing.state ?? null,
            billingCountry: billing.country,
            billingPhone: billing.phone ?? null,
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            couponCode: appliedCoupon?.code ?? null,
            shippingMethod,
            shippingFee: pricing.shippingFee,
            tax: pricing.tax,
            total: pricing.total,
            notes: notes ?? null,
            ...checkoutAdDetails(adConsent, request),
          })
          .returning()

        await tx.insert(orderItems).values(priced.map((l) => ({ orderId: order.id, ...l })))

        /* Reserve stock and record why. The CHECK constraint on the column is
           the backstop if this logic is ever wrong. */
        for (const l of priced) {
          await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
            .where(eq(productVariants.id, l.variantId))
          await tx.insert(stockLedger).values({
            variantId: l.variantId,
            orderId: order.id,
            delta: -l.quantity,
            reason: 'order_reserved',
          })
        }

        if (appliedCoupon) {
          await tx
            .update(coupons)
            .set({ redemptionCount: sql`${coupons.redemptionCount} + 1` })
            .where(eq(coupons.id, appliedCoupon.id))
          await tx.insert(couponRedemptions).values({
            couponId: appliedCoupon.id,
            orderId: order.id,
            userId,
          })
        }

        /* Gateway order last: if it throws, the transaction rolls back and the
           reserved stock is released with it. */
        const gateway = getGateway()
        const gatewayOrder = await gateway
          .createOrder({
            amount: pricing.total,
            receipt: number,
            notes: { order_number: number },
          })
          .catch((err: unknown) => {
            // Bad keys, an outage or a timeout. The detail is for operators, not shoppers.
            request.log.error({ err, orderNumber: number }, 'gateway order creation failed')
            throw new ApiError(
              502,
              'gateway_unavailable',
              'Payment unavailable',
              'We could not start payment just now. Nothing has been charged — please try again shortly.',
            )
          })

        await tx.insert(payments).values({
          orderId: order.id,
          provider: gateway.name,
          providerOrderId: gatewayOrder.id,
          amount: pricing.total,
          status: 'created',
        })

        return { order, items: priced, gatewayOrder, provider: gateway.name }
      })
      // After commit, and not awaited: a staff email must not slow a checkout.
      void checkLowStock(result.items.map((l) => l.variantId), { log: request.log })

      const dto = toOrderDto({
        ...result.order,
        items: result.items.map((l) => ({ ...l, id: '', orderId: result.order.id })) as never,
      })

      return {
        order: dto,
        payment: {
          provider: result.provider,
          gatewayOrderId: result.gatewayOrder.id,
          amount: result.gatewayOrder.amount,
          currency: result.gatewayOrder.currency,
          publicKey: result.gatewayOrder.publicKey,
        },
        guestAccessToken,
      }
    },
  )

  app.get(
    '/orders',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Your order history',
        description: 'Requires a session. Orders belong to an account, not to a browser.',
        response: { 200: z.object({ orders: z.array(orderDto) }), 401: problemSchema },
      },
    },
    async (request) => {
      if (!request.session) {
        throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to see your orders.')
      }
      const rows = await db.query.orders.findMany({
        where: eq(orders.userId, request.session.userId),
        with: { items: true, shipment: true },
        orderBy: desc(orders.placedAt),
      })
      return { orders: rows.map(toOrderDto) }
    },
  )

  app.get(
    '/orders/:number',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'One order',
        description:
          'Readable by the account that placed it. A guest supplies the high-entropy checkout token in X-Order-Access-Token.',
        params: z.object({ number: z.string().min(3).max(40) }),
        headers: z.object({ 'x-order-access-token': z.string().min(40).max(100).optional() }).passthrough(),
        response: { 200: orderDto, 404: problemSchema },
      },
    },
    async (request) => {
      const row = await db.query.orders.findFirst({
        where: eq(orders.number, request.params.number),
        with: { items: true, shipment: true },
      })
      if (!row) throw ApiError.notFound(`Order ${request.params.number}`)

      const ownedBySession = row.userId !== null && request.session?.userId === row.userId
      const hasGuestAccess = guestAccessMatches(row, request.headers['x-order-access-token'])
      if (!ownedBySession && !hasGuestAccess) {
        // Do not confirm whether a guessed number exists.
        throw ApiError.notFound('That order')
      }
      return { ...toOrderDto(row), refunds: await customerRefunds(row.id) }
    },
  )

  app.get(
    '/orders/:number/invoice',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'Your issued invoice',
        description: 'Readable by the order account or by a guest holding the checkout access token. The browser can print this document to PDF.',
        params: z.object({ number: z.string().min(3).max(40) }),
        headers: z.object({ 'x-order-access-token': z.string().min(40).max(100).optional() }).passthrough(),
        response: { 200: z.object({ invoice: z.any() }), 404: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      const permitted =
        (order.userId !== null && request.session?.userId === order.userId) ||
        guestAccessMatches(order, request.headers['x-order-access-token'])
      if (!permitted) throw ApiError.notFound('That order')
      const invoice = await getInvoiceView(order.id)
      if (!invoice) throw ApiError.notFound(`An invoice for ${request.params.number}`)
      return { invoice }
    },
  )

  app.get(
    '/orders/:number/payment',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'Resume payment for an unpaid order',
        description:
          'Returns the gateway handle for an order still awaiting payment, so a customer who closed the payment window can pay from the order page before the hold expires.',
        params: z.object({ number: z.string().min(3).max(40) }),
        headers: z.object({ 'x-order-access-token': z.string().min(40).max(100).optional() }).passthrough(),
        response: {
          200: z.object({
            provider: z.string(),
            gatewayOrderId: z.string(),
            amount: paiseSchema,
            currency: z.string(),
            publicKey: z.string(),
          }),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.number, request.params.number),
        with: { payments: true },
      })
      if (!order) throw ApiError.notFound('That order')
      const permitted =
        (order.userId !== null && request.session?.userId === order.userId) ||
        guestAccessMatches(order, request.headers['x-order-access-token'])
      if (!permitted) throw ApiError.notFound('That order')
      if (order.status !== 'pending_payment') {
        throw ApiError.conflict('order_not_payable', 'This order is no longer awaiting payment.')
      }
      const payment = order.payments.find((p) => p.status === 'created')
      if (!payment) throw ApiError.conflict('order_not_payable', 'This order has no open payment. Please place it again.')
      return {
        provider: payment.provider,
        gatewayOrderId: payment.providerOrderId,
        amount: payment.amount,
        currency: payment.currency,
        publicKey: payment.provider === 'razorpay' ? (env.RAZORPAY_KEY_ID ?? '') : 'rzp_test_fake',
      }
    },
  )

  app.post(
    '/orders/:number/return-requests',
    {
      schema: {
        tags: ['Orders'],
        summary: 'Request a cancellation or return',
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z.object({ type: z.enum(['cancellation', 'return']), reason: z.string().trim().min(10).max(500) }),
        response: { 201: z.object({ id: z.string().uuid(), status: z.literal('requested') }), 401: problemSchema, 404: problemSchema, 409: problemSchema },
      },
    },
    async (request, reply) => {
      if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to request a return.')
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order || order.userId !== request.session.userId) throw ApiError.notFound('That order')
      if (!['paid', 'packed', 'shipped', 'delivered'].includes(order.status)) {
        throw ApiError.conflict('return_not_available', 'This order is not eligible for a cancellation or return request.')
      }
      const existing = await db.query.returnRequests.findFirst({ where: eq(returnRequests.orderId, order.id) })
      if (existing) throw ApiError.conflict('return_already_requested', 'A cancellation or return request already exists for this order.')
      const [created] = await db.insert(returnRequests).values({ orderId: order.id, type: request.body.type, reason: request.body.reason }).returning({ id: returnRequests.id })
      return reply.status(201).send({ id: created.id, status: 'requested' as const })
    },
  )
}

/** Sends the confirmation email. Called from the webhook, never from checkout. */
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const row = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } })
  if (!row) return
  await sendEmail({
    to: row.email,
    subject: `Order ${row.number} confirmed`,
    heading: 'Payment received — thank you',
    body: [
      `Thank you — we have your order and payment for ${row.number}.`,
      'We pack to order rather than from a warehouse shelf, so allow a day or two before the courier collects. You will get tracking as soon as it ships.',
    ],
    facts: [
      ...row.items.map((i) => [`${i.productName} (${i.variantSize}) × ${i.quantity}`, formatPaise(i.lineTotal)] as [string, string]),
      ['Shipping', row.shippingFee === 0 ? 'Free' : formatPaise(row.shippingFee)],
      ['Total paid', formatPaise(row.total)],
      [`Includes GST (${TAX_RATE * 100}%)`, formatPaise(row.tax)],
    ],
    action: { label: 'View your order', url: `${env.SITE_URL}/order/${encodeURIComponent(row.number)}` },
    footnote: `Delivering to ${row.shippingName}, ${row.shippingCity} ${row.shippingPostalCode}.`,
  })
}

/**
 * Cancels abandoned checkouts and restores their reserved stock atomically.
 * Each order is first checked with the gateway, so a payment whose webhook
 * and browser confirmation were both lost is captured rather than cancelled.
 * The row lock and status re-check mean concurrent sweepers or a late gateway
 * callback cannot release the same order twice.
 */
export async function expirePendingOrders(olderThan: Date, log: FastifyBaseLogger, limit = 100): Promise<number> {
  const candidates = await db
    .select({ id: orders.id, number: orders.number })
    .from(orders)
    .where(and(eq(orders.status, 'pending_payment'), lt(orders.placedAt, olderThan)))
    .limit(limit)

  let expired = 0
  for (const candidate of candidates) {
    /* Ask the gateway first, outside any transaction so no row is locked
       during the network call. If the webhook and the browser verify call
       were both lost, this is the last chance to notice the customer paid. */
    const outcome = await reconcileWithGateway(candidate, log)
    if (outcome !== 'unpaid') continue

    const didExpire = await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ id: orders.id, status: orders.status, placedAt: orders.placedAt })
        .from(orders)
        .where(eq(orders.id, candidate.id))
        .for('update')

      if (!order || order.status !== 'pending_payment' || order.placedAt >= olderThan) return false

      await tx
        .update(orders)
        .set({ status: 'cancelled', cancelledAt: new Date() })
        .where(eq(orders.id, order.id))
      await tx
        .update(payments)
        .set({ status: 'failed' })
        .where(and(eq(payments.orderId, order.id), eq(payments.status, 'created')))

      await releaseOrderHoldings(tx, order.id, 'Pending payment expired')
      return true
    })
    if (didExpire) expired += 1
  }
  return expired
}

/**
 * Checks with the gateway whether an order that looks unpaid was in fact paid.
 *
 * - `paid`: a captured payment was found and the order is now paid.
 * - `unknown`: the gateway could not be asked. The order is left alone and the
 *   next sweep tries again, because cancelling a paid order is far worse than
 *   holding stock for another minute.
 * - `unpaid`: nothing was captured; the order may be expired.
 */
async function reconcileWithGateway(
  order: { id: string; number: string },
  log: FastifyBaseLogger,
): Promise<'paid' | 'unknown' | 'unpaid'> {
  const [payment] = await db
    .select({ id: payments.id, provider: payments.provider, providerOrderId: payments.providerOrderId })
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.status, 'created')))
    .limit(1)
  if (!payment) return 'unpaid'

  const gateway = getGateway()
  // An order created under a different gateway (e.g. a test order after a
  // switch to live keys) cannot be looked up with this one.
  if (payment.provider !== gateway.name) return 'unpaid'

  let attempts
  try {
    attempts = await gateway.fetchOrderPayments(payment.providerOrderId)
  } catch (err) {
    log.warn({ err, orderNumber: order.number }, 'could not check payment status before expiry; will retry')
    return 'unknown'
  }

  const captured = attempts.find((attempt) => attempt.status === 'captured')
  if (captured) {
    const didCapture = await capturePayment(
      {
        orderId: order.id,
        orderNumber: order.number,
        paymentRowId: payment.id,
        paymentId: captured.paymentId,
        method: captured.method ?? null,
      },
      log,
    )
    if (didCapture) log.warn({ orderNumber: order.number }, 'payment found during expiry check; order marked paid')
    // Either it is paid now, or something else (webhook, verify) got there first.
    return 'paid'
  }

  if (attempts.some((attempt) => attempt.status === 'authorized')) {
    log.warn(
      { orderNumber: order.number },
      'payment authorized but never captured; check that auto-capture is on in the Razorpay dashboard',
    )
  }
  return 'unpaid'
}

/** True when a paid order from this customer contains the product. */
export async function hasPurchased(userId: string, productSlug: string): Promise<boolean> {
  const rows = await db
    .select({ id: orderItems.id })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.userId, userId),
        eq(orderItems.productSlug, productSlug),
        sql`${orders.status} IN ('paid','packed','shipped','delivered')`,
      ),
    )
    .limit(1)
  return rows.length > 0
}
