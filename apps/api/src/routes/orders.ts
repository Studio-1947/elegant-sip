import { createHash, randomBytes } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import {
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
  stockLedger,
} from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { getGateway } from '../lib/gateway.js'
import { sendEmail } from '../lib/email.js'

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
  tracking: z
    .object({ carrier: z.string().nullable(), number: z.string().nullable() })
    .nullable(),
})

/** ES-20260824-K3P9Q — date-prefixed and random, so it cannot collide. */
function generateOrderNumber(): string {
  const d = new Date()
  const stamp = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return `ES-${stamp}-${randomBytes(3).toString('hex').toUpperCase()}`
}

type OrderRow = typeof orders.$inferSelect & { items: (typeof orderItems.$inferSelect)[] }

const toOrderDto = (row: OrderRow) => ({
  number: row.number,
  status: row.status,
  placedAt: row.placedAt.toISOString(),
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
  tracking:
    row.trackingNumber || row.trackingCarrier
      ? { carrier: row.trackingCarrier, number: row.trackingNumber }
      : null,
})

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
          email: z.string().trim().toLowerCase().email(),
          shipping: addressSchema,
          shippingMethod: shippingMethodIdSchema.default('standard'),
          couponCode: z.string().trim().toUpperCase().max(32).optional(),
          notes: z.string().trim().max(500).optional(),
        }),
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
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const { items, email, shipping, shippingMethod, couponCode, notes } = request.body
      const userId = request.session?.userId ?? null
      const guestAccessToken = userId ? null : randomBytes(32).toString('base64url')
      const guestAccessTokenHash = guestAccessToken
        ? createHash('sha256').update(guestAccessToken).digest('hex')
        : null

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
        if (couponCode) {
          const c = await tx.query.coupons.findFirst({ where: eq(coupons.code, couponCode) })
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
            email,
            shippingName: shipping.name,
            shippingLine1: shipping.line1,
            shippingCity: shipping.city,
            shippingPostalCode: shipping.postalCode,
            shippingState: shipping.state ?? null,
            shippingCountry: shipping.country,
            shippingPhone: shipping.phone ?? null,
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            couponCode: appliedCoupon?.code ?? null,
            shippingMethod,
            shippingFee: pricing.shippingFee,
            tax: pricing.tax,
            total: pricing.total,
            notes: notes ?? null,
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
        const gatewayOrder = await gateway.createOrder({
          amount: pricing.total,
          receipt: number,
          notes: { order_number: number },
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
        with: { items: true },
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
        with: { items: true },
      })
      if (!row) throw ApiError.notFound(`Order ${request.params.number}`)

      const ownedBySession = request.session?.userId === row.userId
      const token = request.headers['x-order-access-token']
      const suppliedHash = typeof token === 'string' ? createHash('sha256').update(token).digest('hex') : null
      const hasGuestAccess = row.userId === null && suppliedHash === row.guestAccessTokenHash
      if (!ownedBySession && !hasGuestAccess) {
        // Do not confirm whether a guessed number exists.
        throw ApiError.notFound('That order')
      }
      return toOrderDto(row)
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
    heading: 'Your tea is on its way',
    body: [
      `Thank you — we have your order and payment for ${row.number}.`,
      'We pack to order rather than from a warehouse shelf, so allow a day or two before the courier collects. You will get tracking as soon as it ships.',
    ],
    facts: [
      ...row.items.map((i) => [`${i.productName} (${i.variantSize}) × ${i.quantity}`, formatPaise(i.lineTotal)] as [string, string]),
      ['Shipping', row.shippingFee === 0 ? 'Free' : formatPaise(row.shippingFee)],
      ['GST (5%)', formatPaise(row.tax)],
      ['Total paid', formatPaise(row.total)],
    ],
    footnote: `Delivering to ${row.shippingName}, ${row.shippingCity} ${row.shippingPostalCode}.`,
  })
}

/** Releases reserved stock when a payment fails or an order is cancelled. */
export async function releaseStock(orderId: string, reason: 'order_released' = 'order_released'): Promise<void> {
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  await db.transaction(async (tx) => {
    for (const l of lines) {
      if (!l.variantId) continue
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${l.quantity}` })
        .where(eq(productVariants.id, l.variantId))
      await tx.insert(stockLedger).values({
        variantId: l.variantId,
        orderId,
        delta: l.quantity,
        reason,
      })
    }
  })
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
