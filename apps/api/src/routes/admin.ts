import { and, desc, eq, lte, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { adminAuditEvents, orders, returnRequests, shipments, stockLedger, users } from '../db/schema-commerce.js'
import { releaseOrderHoldings } from './orders.js'
import { ApiError } from '../lib/problem.js'
import { adminProductRoutes } from './admin-products.js'
import { adminReviewRoutes } from './admin-reviews.js'
import { adminShippingRoutes } from './admin-shipping.js'
import { adminOutboxRoutes } from './admin-outbox.js'
import { adminAuditRoutes } from './admin-audit.js'
import { checkLowStock } from '../lib/low-stock.js'
import { adminGardenRoutes } from './admin-gardens.js'
import { adminSettingsRoutes } from './admin-settings.js'
import { adminRefundRoutes } from './admin-refunds.js'
import { capturedPayment, refundTotals } from '../lib/refunds.js'
import { getStoreSettings } from '../lib/settings.js'
import { getInvoiceView } from '../lib/invoice.js'
import { cancelOrderWithShipment, sendDeliveredEmail, sendShippedEmail } from '../lib/fulfilment.js'
import { env } from '../env.js'
import { metaCapiLastError, metaCapiMode } from '../lib/meta-capi.js'

/** The status changes staff may make by hand. Anything else is a 409. */
const STAFF_TRANSITIONS: Record<string, readonly string[]> = {
  pending_payment: ['cancelled'],
  paid: ['packed', 'shipped', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  // Cancelling a shipped order is only for a parcel coming back (rto); see the PATCH handler.
  shipped: ['delivered', 'cancelled'],
  // Only a fully refunded order that never shipped; it keeps its refunded status (see cancelOrderAndRelease).
  refunded: ['cancelled'],
}

/**
 * Cancels an order and returns its stock and coupon use, once. False if it
 * had already moved on. A booked courier shipment is cancelled first, and a
 * parcel already with the courier refuses the cancel (409).
 */
async function cancelOrderAndRelease(
  order: { id: string; number: string },
  fromStatuses: string[],
  note: string,
  log: FastifyBaseLogger,
): Promise<boolean> {
  return cancelOrderWithShipment(order.id, order.number, log, async (tx) => {
    const [locked] = await tx
      .select({ status: orders.status, cancelledAt: orders.cancelledAt, shippedAt: orders.shippedAt })
      .from(orders)
      .where(eq(orders.id, order.id))
      .for('update')
    if (!locked || !fromStatuses.includes(locked.status)) return false
    /* A refunded order stays `refunded`; cancelledAt records that it is not
       being sent. One cancelled before its refund has already released its stock. */
    if (locked.status === 'refunded' && (locked.cancelledAt || locked.shippedAt)) return false
    await tx
      .update(orders)
      .set({ status: locked.status === 'refunded' ? 'refunded' : 'cancelled', cancelledAt: new Date() })
      .where(eq(orders.id, order.id))
    await releaseOrderHoldings(tx, order.id, note)
    return true
  })
}

/* ────────────────────────────────────────────────────────────────────────────
 * Admin.
 *
 * What the storefront's staff page (/admin, AdminPage.tsx) calls to run the
 * shop: the order queue, stock, prices, review moderation. It is part of the
 * storefront rather than a separate admin application to build and secure.
 *
 * Every route in this plugin is behind requireAdmin via a hook, so a new route
 * added here cannot accidentally ship unauthenticated.
 * ──────────────────────────────────────────────────────────────────────────── */

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', async (request) => {
    if (!request.session) {
      throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    }
    /* The role is read from the database, not the session: a session carries
       the role it was created with for 30 days, so a demoted member of staff
       would otherwise keep admin access until it expired. */
    const actor = await db.query.users.findFirst({ where: eq(users.id, request.session.userId), columns: { role: true } })
    if (actor?.role !== 'admin') {
      // 403, not 404: the caller is authenticated and simply lacks the role.
      throw new ApiError(403, 'forbidden', 'Not permitted', 'This area is restricted to shop staff.')
    }
  })

  app.addHook('onResponse', async (request, reply) => {
    // Read-only staff views are intentionally omitted. Never log request bodies:
    // they can contain customer data and an audit trail should minimise it.
    if (request.method === 'GET' || reply.statusCode >= 400 || !request.session) return
    const route = request.routeOptions.url ?? request.url.split('?')[0]
    await db.insert(adminAuditEvents).values({
      actorId: request.session.userId,
      action: `${request.method} ${route}`,
      resource: request.url.split('?')[0],
      statusCode: reply.statusCode,
    })
  })

  /* Catalogue management lives in its own module (300-line rule) but registers
     here, inside the auth hook above. */
  await app.register(adminProductRoutes)
  await app.register(adminReviewRoutes)
  await app.register(adminShippingRoutes)
  await app.register(adminOutboxRoutes)
  await app.register(adminAuditRoutes)
  await app.register(adminGardenRoutes)
  await app.register(adminSettingsRoutes)
  await app.register(adminRefundRoutes)

  app.get(
    '/admin/orders',
    {
      schema: {
        tags: ['Admin'],
        summary: 'The order queue',
        querystring: z.object({
          status: z
            .enum(['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'])
            .optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
        response: {
          200: z.object({
            orders: z.array(
              z.object({
                number: z.string(),
                status: z.string(),
                placedAt: z.iso.datetime(),
                email: z.string(),
                total: paiseSchema,
                itemCount: z.number().int(),
                shippingCity: z.string(),
                trackingNumber: z.string().nullable(),
                shipmentStatus: z.string().nullable(),
              }),
            ),
          }),
          401: problemSchema,
          403: problemSchema,
        },
      },
    },
    async (request) => {
      const rows = await db.query.orders.findMany({
        where: request.query.status ? eq(orders.status, request.query.status) : undefined,
        with: { items: true, shipment: true },
        orderBy: desc(orders.placedAt),
        limit: request.query.limit,
      })
      return {
        orders: rows.map((o) => ({
          number: o.number,
          status: o.status,
          placedAt: o.placedAt.toISOString(),
          email: o.email,
          total: o.total,
          itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
          shippingCity: o.shippingCity,
          trackingNumber: o.trackingNumber,
          shipmentStatus: o.shipment?.status ?? null,
        })),
      }
    },
  )

  app.get(
    '/admin/return-requests',
    {
      schema: {
        tags: ['Admin'], summary: 'Cancellation and return queue',
        querystring: z.object({ status: z.enum(['requested', 'approved', 'rejected', 'received']).optional() }),
        response: { 200: z.object({ requests: z.array(z.object({ id: z.string().uuid(), number: z.string(), type: z.string(), status: z.string(), reason: z.string(), requestedAt: z.iso.datetime() })) }) },
      },
    },
    async (request) => {
      const rows = await db.query.returnRequests.findMany({
        where: request.query.status ? eq(returnRequests.status, request.query.status) : undefined,
        with: { order: true },
        orderBy: desc(returnRequests.requestedAt),
      })
      return { requests: rows.map((item) => ({ id: item.id, number: item.order.number, type: item.type, status: item.status, reason: item.reason, requestedAt: item.requestedAt.toISOString() })) }
    },
  )

  app.patch(
    '/admin/return-requests/:id',
    {
      schema: {
        tags: ['Admin'], summary: 'Review a cancellation or return request',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ status: z.enum(['approved', 'rejected', 'received']), staffNote: z.string().trim().max(500).optional() }),
        response: { 200: z.object({ ok: z.literal(true), restocked: z.boolean() }), 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const item = await db.query.returnRequests.findFirst({ where: eq(returnRequests.id, request.params.id), with: { order: { with: { items: true } } } })
      if (!item) throw ApiError.notFound('That return request')
      const { status, staffNote } = request.body
      const allowed = (item.status === 'requested' && (status === 'approved' || status === 'rejected')) || (item.status === 'approved' && status === 'received')
      if (!allowed) throw ApiError.conflict('invalid_return_transition', `Cannot change a ${item.status} request to ${status}.`)
      let restocked = false
      /* Approving a cancellation cancels the order and returns its stock. Once
         the parcel has left, it can only come back as a return. The refund is
         a separate staff action on the order (POST /admin/orders/:number/refunds). */
      if (item.type === 'cancellation' && status === 'approved') {
        if (!['paid', 'packed'].includes(item.order.status)) {
          throw ApiError.conflict(
            'order_already_dispatched',
            `This order is ${item.order.status}. Reject the cancellation and handle it as a return instead.`,
          )
        }
        const cancelled = await cancelOrderAndRelease(item.order, ['paid', 'packed'], `Cancellation request ${item.id} approved`, request.log)
        if (!cancelled) throw ApiError.conflict('order_changed', 'The order changed while you were reviewing it. Reload and try again.')
        restocked = true
      }
      await db.transaction(async (tx) => {
        await tx.update(returnRequests).set({ status, staffNote: staffNote ?? item.staffNote, ...(status === 'approved' || status === 'rejected' ? { decidedAt: new Date() } : {}), ...(status === 'received' ? { receivedAt: new Date() } : {}) }).where(eq(returnRequests.id, item.id))
        // Only inspected, accepted physical returns go back into available stock.
        if (status === 'received' && item.type === 'return') {
          for (const line of item.order.items) {
            if (!line.variantId) continue
            await tx.update(productVariants).set({ stock: sql`${productVariants.stock} + ${line.quantity}` }).where(eq(productVariants.id, line.variantId))
            await tx.insert(stockLedger).values({ variantId: line.variantId, orderId: item.order.id, delta: line.quantity, reason: 'restock', note: `Return request ${item.id} received` })
          }
          restocked = true
        }
      })
      if (restocked) await checkLowStock(item.order.items.flatMap((line) => (line.variantId ? [line.variantId] : [])), { log: request.log })
      return { ok: true as const, restocked }
    },
  )

  app.get(
    '/admin/orders/:number',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Full order detail for fulfilment staff',
        params: z.object({ number: z.string().min(3).max(40) }),
        response: {
          200: z.object({
            number: z.string(),
            status: z.string(),
            placedAt: z.iso.datetime(),
            email: z.string(),
            phone: z.string().nullable(),
            notes: z.string().nullable(),
            items: z.array(z.object({ productName: z.string(), variantSize: z.string(), quantity: z.number().int() })),
            shipping: z.object({ name: z.string(), line1: z.string(), city: z.string(), postalCode: z.string(), state: z.string().nullable(), country: z.string() }),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.number, request.params.number),
        with: { items: true },
      })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      return {
        number: order.number,
        status: order.status,
        placedAt: order.placedAt.toISOString(),
        email: order.email,
        phone: order.shippingPhone,
        notes: order.notes,
        items: order.items.map((item) => ({ productName: item.productName, variantSize: item.variantSize, quantity: item.quantity })),
        shipping: {
          name: order.shippingName,
          line1: order.shippingLine1,
          city: order.shippingCity,
          postalCode: order.shippingPostalCode,
          state: order.shippingState,
          country: order.shippingCountry,
        },
      }
    },
  )

  app.patch(
    '/admin/orders/:number',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Advance an order',
        description:
          'Setting status to `shipped` with a tracking number emails the customer. Nothing is emailed unless the tracking details are actually present — the message would otherwise promise information it does not carry. The first move to `delivered` emails the customer too. `notified` is true only when an email was actually sent.',
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z.object({
          status: z.enum(['packed', 'shipped', 'delivered', 'cancelled']).optional(),
          trackingCarrier: z.string().trim().max(60).optional(),
          trackingNumber: z.string().trim().max(60).optional(),
        }),
        response: {
          // refundDue: a cancelled order whose captured payment is not yet fully refunded.
          200: z.object({ ok: z.literal(true), notified: z.boolean(), refundDue: z.boolean().optional() }),
          404: problemSchema,
          409: problemSchema,
        },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)

      const { status, trackingCarrier, trackingNumber } = request.body
      if (status && status !== order.status && !STAFF_TRANSITIONS[order.status]?.includes(status)) {
        throw ApiError.conflict(
          'invalid_status_change',
          `A ${order.status.replaceAll('_', ' ')} order cannot be marked ${status}.`,
        )
      }

      /* Cancelling returns the held stock and coupon use in the same
         transaction. It does not refund: `refundDue` tells staff the payment
         still has to be refunded from the order (POST …/refunds). */
      if (status === 'cancelled' && order.status !== 'cancelled') {
        if (order.status === 'refunded' && (order.cancelledAt || order.shippedAt)) {
          throw ApiError.conflict(
            'invalid_status_change',
            order.cancelledAt ? 'This order is already cancelled.' : 'This order has shipped. Handle the parcel as a return instead.',
          )
        }
        // A shipped order can only be cancelled once its parcel is on its way back.
        if (order.status === 'shipped') {
          const shipment = await db.query.shipments.findFirst({ where: eq(shipments.orderId, order.id), columns: { status: true } })
          if (shipment?.status !== 'rto') {
            throw ApiError.conflict(
              'invalid_status_change',
              'A shipped order can only be cancelled once the courier is returning it (RTO). Otherwise handle it as a return.',
            )
          }
        }
        const cancelled = await cancelOrderAndRelease(order, [order.status], 'Cancelled by staff', request.log)
        if (!cancelled) throw ApiError.conflict('order_changed', 'The order changed while you were updating it. Reload and try again.')
        const payment = await capturedPayment(order.id)
        const refundDue = payment ? (await refundTotals(payment.id, payment.amount)).refundable > 0 : false
        if (refundDue) request.log.info({ orderNumber: order.number }, 'paid order cancelled by staff; refund still due')
        return { ok: true as const, notified: false, refundDue }
      }

      // Only the first move to shipped stamps shippedAt and emails; correcting tracking later does neither.
      const changing = Boolean(status) && status !== order.status
      const firstShip = status === 'shipped' && changing
      const updated = await db
        .update(orders)
        .set({
          ...(status ? { status } : {}),
          ...(trackingCarrier !== undefined ? { trackingCarrier } : {}),
          ...(trackingNumber !== undefined ? { trackingNumber } : {}),
          ...(firstShip ? { shippedAt: new Date() } : {}),
          ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
        })
        /* A status change applies only if nobody else (staff or a courier
           update) moved the order meanwhile, so its email goes out once. */
        .where(changing ? and(eq(orders.id, order.id), eq(orders.status, order.status)) : eq(orders.id, order.id))
        .returning({ id: orders.id })
      if (updated.length === 0) throw ApiError.conflict('order_changed', 'The order changed while you were updating it. Reload and try again.')

      let notified = false
      const carrier = trackingCarrier ?? order.trackingCarrier
      const tracking = trackingNumber ?? order.trackingNumber
      if (firstShip && tracking) {
        const result = await sendShippedEmail(order, carrier, tracking)
        notified = result.delivered
      }
      if (status === 'delivered' && changing) {
        // sendEmail never throws, but the status has already changed either way.
        const result = await sendDeliveredEmail(order).catch((err) => {
          request.log.error({ err, orderNumber: order.number }, 'delivered email failed')
          return { delivered: false }
        })
        notified = result.delivered
      }

      return { ok: true as const, notified }
    },
  )

  app.get(
    '/admin/orders/:number/invoice',
    {
      schema: {
        tags: ['Admin'],
        summary: 'GST invoice for an order',
        description:
          'Returns the invoice as structured data. Without SELLER_GSTIN set, `isTaxInvoice` is false and the document is provisional — it cannot claim to be a tax invoice without a GSTIN.',
        params: z.object({ number: z.string().min(3).max(40) }),
        response: { 200: z.object({ invoice: z.any() }), 404: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      const invoice = await getInvoiceView(order.id)
      if (!invoice) throw ApiError.notFound(`An invoice for ${request.params.number}`)
      return { invoice }
    },
  )

  app.post(
    '/admin/stock',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Adjust stock',
        description:
          'Applies a delta and records it in the append-only ledger, so the running total always has an explanation behind it.',
        body: z.object({
          productSlug: slugSchema,
          variantSize: z.string().min(1),
          delta: z.number().int().refine((n) => n !== 0, 'Delta must be non-zero'),
          note: z.string().trim().max(200).optional(),
        }),
        response: {
          200: z.object({ productSlug: slugSchema, variantSize: z.string(), stock: z.number().int() }),
          400: problemSchema,
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const { productSlug, variantSize, delta, note } = request.body
      const variant = await db
        .select({ id: productVariants.id, stock: productVariants.stock, size: productVariants.size })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(products.slug, productSlug))
        .then((rows) => rows.find((r) => r.size === variantSize))

      if (!variant) throw ApiError.notFound(`Variant "${variantSize}" of "${productSlug}"`)
      if (variant.stock + delta < 0) {
        throw ApiError.badRequest(
          `That would take stock to ${variant.stock + delta}. Current stock is ${variant.stock}.`,
        )
      }

      const [updated] = await db.transaction(async (tx) => {
        const rows = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} + ${delta}` })
          .where(eq(productVariants.id, variant.id))
          .returning({ stock: productVariants.stock })
        await tx.insert(stockLedger).values({
          variantId: variant.id,
          delta,
          reason: delta > 0 ? 'restock' : 'manual_adjustment',
          note: note ?? null,
        })
        return rows
      })
      await checkLowStock([variant.id], { log: request.log })

      return { productSlug, variantSize, stock: updated.stock }
    },
  )

  app.get(
    '/admin/stock/low',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Low-stock variants of teas on sale, for the staff dashboard',
        description: 'Without `threshold`, uses the low-stock threshold from the shop settings.',
        querystring: z.object({ threshold: z.coerce.number().int().min(0).max(1000).optional() }),
        response: { 200: z.object({ variants: z.array(z.object({ productSlug: slugSchema, productName: z.string(), size: z.string(), sku: z.string(), stock: z.number().int() })) }) },
      },
    },
    async (request) => {
      const threshold = request.query.threshold ?? (await getStoreSettings()).lowStockThreshold
      const variants = await db
        .select({ productSlug: products.slug, productName: products.name, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        // Coming-soon teas have no stock by design; only teas on sale can run low.
        .where(and(lte(productVariants.stock, threshold), eq(products.status, 'active')))
        .orderBy(productVariants.stock, products.name, productVariants.size)
      return { variants }
    },
  )

  app.get(
    '/admin/config',
    {
      schema: {
        tags: ['Admin'],
        summary: 'What this deployment can actually do',
        description:
          'Reports which integrations are configured, so an operator can see at a glance whether payments and email are live rather than discovering it during a sale.',
        response: {
          200: z.object({
            paymentProvider: z.string(),
            paymentsLive: z.boolean(),
            emailConfigured: z.boolean(),
            gstinConfigured: z.boolean(),
            sellerState: z.string(),
            shippingProvider: z.string(),
            shippingLive: z.boolean(),
            /** Meta Conversions API: off (no token), test (test event code set) or live. */
            metaServerEvents: z.enum(['off', 'test', 'live']),
            /** The latest delivery failure since the API started, cleared by the next success. */
            metaServerEventsError: z.string().nullable(),
          }),
        },
      },
    },
    async () => ({
      paymentProvider: env.PAYMENT_PROVIDER,
      // Test keys take real-looking payments that never settle — not live.
      paymentsLive: env.PAYMENT_PROVIDER === 'razorpay' && Boolean(env.RAZORPAY_KEY_ID?.startsWith('rzp_live_')),
      emailConfigured: Boolean(env.SMTP_URL),
      gstinConfigured: Boolean(env.SELLER_GSTIN),
      sellerState: env.SELLER_STATE,
      shippingProvider: env.SHIPPING_PROVIDER,
      shippingLive: env.SHIPPING_PROVIDER === 'shiprocket',
      metaServerEvents: metaCapiMode(),
      metaServerEventsError: metaCapiLastError()?.message ?? null,
    }),
  )
}
