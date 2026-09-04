import { desc, eq, lte, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema, slugSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products, reviews } from '../db/schema.js'
import { orders, returnRequests, stockLedger } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { adminProductRoutes } from './admin-products.js'
import { getInvoiceView } from '../lib/invoice.js'
import { sendEmail } from '../lib/email.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin.
 *
 * API-only by design: Swagger UI is the interface. Enough to actually run a
 * six-product shop — adjust stock, work the order queue, publish reviews —
 * without the cost of building and securing a separate admin application.
 *
 * Every route in this plugin is behind requireAdmin via a hook, so a new route
 * added here cannot accidentally ship unauthenticated.
 * ──────────────────────────────────────────────────────────────────────────── */

export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('onRequest', async (request) => {
    if (!request.session) {
      throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
    }
    if (request.session.role !== 'admin') {
      // 403, not 404: the caller is authenticated and simply lacks the role.
      throw new ApiError(403, 'forbidden', 'Not permitted', 'This area is restricted to shop staff.')
    }
  })

  /* Catalogue management lives in its own module (300-line rule) but registers
     here, inside the auth hook above. */
  await app.register(adminProductRoutes)

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
        with: { items: true },
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
          'Setting status to `shipped` with a tracking number emails the customer. Nothing is emailed unless the tracking details are actually present — the message would otherwise promise information it does not carry.',
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z.object({
          status: z.enum(['packed', 'shipped', 'delivered', 'cancelled']).optional(),
          trackingCarrier: z.string().trim().max(60).optional(),
          trackingNumber: z.string().trim().max(60).optional(),
        }),
        response: { 200: z.object({ ok: z.literal(true), notified: z.boolean() }), 404: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)

      const { status, trackingCarrier, trackingNumber } = request.body
      await db
        .update(orders)
        .set({
          ...(status ? { status } : {}),
          ...(trackingCarrier !== undefined ? { trackingCarrier } : {}),
          ...(trackingNumber !== undefined ? { trackingNumber } : {}),
          ...(status === 'shipped' ? { shippedAt: new Date() } : {}),
          ...(status === 'cancelled' ? { cancelledAt: new Date() } : {}),
        })
        .where(eq(orders.id, order.id))

      let notified = false
      const carrier = trackingCarrier ?? order.trackingCarrier
      const tracking = trackingNumber ?? order.trackingNumber
      if (status === 'shipped' && tracking) {
        const result = await sendEmail({
          to: order.email,
          subject: `Order ${order.number} has shipped`,
          heading: 'On its way to you',
          body: [
            `${order.shippingName}, your tea has left us and is with the courier.`,
            'Darjeeling travels well, but give it a day to settle before you brew the first cup.',
          ],
          facts: [
            ['Order', order.number],
            ...(carrier ? ([['Carrier', carrier]] as [string, string][]) : []),
            ['Tracking', tracking],
          ],
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

      return { productSlug, variantSize, stock: updated.stock }
    },
  )

  app.get(
    '/admin/stock/low',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Low-stock variants for the staff dashboard',
        querystring: z.object({ threshold: z.coerce.number().int().min(0).max(1000).default(5) }),
        response: { 200: z.object({ variants: z.array(z.object({ productSlug: slugSchema, productName: z.string(), size: z.string(), sku: z.string(), stock: z.number().int() })) }) },
      },
    },
    async (request) => {
      const variants = await db
        .select({ productSlug: products.slug, productName: products.name, size: productVariants.size, sku: productVariants.sku, stock: productVariants.stock })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(lte(productVariants.stock, request.query.threshold))
        .orderBy(productVariants.stock, products.name, productVariants.size)
      return { variants }
    },
  )

  app.patch(
    '/admin/reviews/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Publish or unpublish a review',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ published: z.boolean() }),
        response: { 200: z.object({ ok: z.literal(true) }), 404: problemSchema },
      },
    },
    async (request) => {
      const rows = await db
        .update(reviews)
        .set({ publishedAt: request.body.published ? new Date() : null })
        .where(eq(reviews.id, request.params.id))
        .returning({ id: reviews.id })
      if (rows.length === 0) throw ApiError.notFound('That review')
      return { ok: true as const }
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
          }),
        },
      },
    },
    async () => ({
      paymentProvider: env.PAYMENT_PROVIDER,
      paymentsLive: env.PAYMENT_PROVIDER === 'razorpay',
      emailConfigured: Boolean(env.SMTP_URL),
      gstinConfigured: Boolean(env.SELLER_GSTIN),
      sellerState: env.SELLER_STATE,
    }),
  )
}
