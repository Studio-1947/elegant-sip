import { and, count, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, refunds, returnRequests, shipments } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { sendOrderConfirmation } from './orders.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — finding and working on orders: the searchable queue, the full order
 * record (money, payment, customer, request), staff notes, correcting a
 * delivery address before dispatch, resending the confirmation, CSV export.
 *
 * Registered inside admin.ts, so the admin role check and audit log cover it.
 * Status changes stay in admin.ts (PATCH /admin/orders/:number).
 * ──────────────────────────────────────────────────────────────────────────── */

export const ORDER_STATUSES = ['pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'] as const
const statusSchema = z.enum(ORDER_STATUSES)

/** A calendar day, YYYY-MM-DD, read as India time (the shop's day). */
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
export const dayStart = (day: string) => new Date(`${day}T00:00:00+05:30`)
export const dayEnd = (day: string) => new Date(dayStart(day).getTime() + 24 * 60 * 60 * 1000)

const filterSchema = z.object({
  status: statusSchema.optional(),
  q: z.string().trim().max(120).optional().describe('Order number, email, name, phone or PIN code'),
  from: daySchema.optional().describe('Placed on or after this day (India time)'),
  to: daySchema.optional().describe('Placed on or before this day (India time)'),
})

function orderFilter(query: z.infer<typeof filterSchema>): SQL | undefined {
  const where: SQL[] = []
  if (query.status) where.push(eq(orders.status, query.status))
  if (query.from) where.push(gte(orders.placedAt, dayStart(query.from)))
  if (query.to) where.push(lt(orders.placedAt, dayEnd(query.to)))
  if (query.q) {
    // LIKE wildcards in the search text are matched literally.
    const term = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
    where.push(
      or(
        ilike(orders.number, term),
        ilike(orders.email, term),
        ilike(orders.shippingName, term),
        ilike(orders.shippingPhone, term),
        ilike(orders.shippingPostalCode, term),
      )!,
    )
  }
  return where.length ? and(...where) : undefined
}

const addressSchema = z.object({
  name: z.string(),
  line1: z.string(),
  city: z.string(),
  postalCode: z.string(),
  state: z.string().nullable(),
  country: z.string(),
})

const detailSchema = z.object({
  number: z.string(),
  status: statusSchema,
  placedAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  shippedAt: z.iso.datetime().nullable(),
  cancelledAt: z.iso.datetime().nullable(),
  email: z.string(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  staffNotes: z.string().nullable(),
  customer: z.object({ id: z.string().uuid(), name: z.string(), email: z.string() }).nullable(),
  items: z.array(
    z.object({
      productSlug: z.string(),
      productName: z.string(),
      variantSize: z.string(),
      sku: z.string(),
      quantity: z.number().int(),
      unitPrice: paiseSchema,
      lineTotal: paiseSchema,
    }),
  ),
  subtotal: paiseSchema,
  discount: paiseSchema,
  couponCode: z.string().nullable(),
  shippingMethod: z.string(),
  shippingFee: paiseSchema,
  tax: paiseSchema,
  total: paiseSchema,
  refunded: paiseSchema,
  shipping: addressSchema,
  billing: addressSchema,
  tracking: z.object({ carrier: z.string().nullable(), number: z.string().nullable() }).nullable(),
  payment: z
    .object({
      provider: z.string(),
      status: z.string(),
      method: z.string().nullable(),
      amount: paiseSchema,
      providerOrderId: z.string(),
      providerPaymentId: z.string().nullable(),
      capturedAt: z.iso.datetime().nullable(),
    })
    .nullable(),
  invoiceNumber: z.string().nullable(),
  returnRequest: z
    .object({
      id: z.string().uuid(),
      type: z.enum(['cancellation', 'return']),
      status: z.enum(['requested', 'approved', 'rejected', 'received']),
      reason: z.string(),
      staffNote: z.string().nullable(),
      requestedAt: z.iso.datetime(),
    })
    .nullable(),
  /** Whether the delivery address can still be corrected (nothing booked with a courier yet). */
  addressEditable: z.boolean(),
})

const iso = (d: Date | null) => d?.toISOString() ?? null

/** Paise refunded (processed) per order. */
async function refundedByOrder(orderIds: string[]): Promise<Map<string, number>> {
  if (orderIds.length === 0) return new Map()
  const rows = await db
    .select({ orderId: refunds.orderId, total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
    .from(refunds)
    .where(and(inArray(refunds.orderId, orderIds), eq(refunds.status, 'processed')))
    .groupBy(refunds.orderId)
  return new Map(rows.map((r) => [r.orderId, r.total]))
}

const ADDRESS_LOCKED_STATUSES = ['shipped', 'delivered', 'cancelled', 'refunded']

async function addressEditable(orderId: string, status: string) {
  if (ADDRESS_LOCKED_STATUSES.includes(status)) return false
  const shipment = await db.query.shipments.findFirst({ where: eq(shipments.orderId, orderId), columns: { status: true } })
  return !shipment || shipment.status === 'cancelled'
}

const csvCell = (value: string | number | null | undefined) => {
  const text = value === null || value === undefined ? '' : String(value)
  // Leading = + - @ would run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}
/** Lets Excel read the file as UTF-8 (names with accents, the rupee sign). */
const BOM = String.fromCharCode(0xfeff)
const rupees = (paise: number) => (paise / 100).toFixed(2)

export const adminOrderRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/orders',
    {
      schema: {
        tags: ['Admin'],
        summary: 'The order queue',
        description:
          'Newest first, filtered and paged. `total` counts every order matching the filters; `counts` is the whole shop by status (ignores the filters), for the dashboard tiles.',
        querystring: filterSchema.extend({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: {
          200: z.object({
            orders: z.array(
              z.object({
                number: z.string(),
                status: z.string(),
                placedAt: z.iso.datetime(),
                email: z.string(),
                customerName: z.string(),
                total: paiseSchema,
                itemCount: z.number().int(),
                shippingCity: z.string(),
                trackingNumber: z.string().nullable(),
                shipmentStatus: z.string().nullable(),
                hasRequest: z.boolean(),
              }),
            ),
            total: z.number().int(),
            counts: z.record(z.string(), z.number().int()),
          }),
          401: problemSchema,
          403: problemSchema,
        },
      },
    },
    async (request) => {
      const where = orderFilter(request.query)
      const [rows, [{ total }], byStatus] = await Promise.all([
        db.query.orders.findMany({
          where,
          with: { items: { columns: { quantity: true } }, shipment: { columns: { status: true } } },
          orderBy: desc(orders.placedAt),
          limit: request.query.limit,
          offset: request.query.offset,
        }),
        db.select({ total: count() }).from(orders).where(where),
        db.select({ status: orders.status, n: count() }).from(orders).groupBy(orders.status),
      ])
      const open = rows.length
        ? await db
            .select({ orderId: returnRequests.orderId })
            .from(returnRequests)
            .where(and(inArray(returnRequests.orderId, rows.map((o) => o.id)), eq(returnRequests.status, 'requested')))
        : []
      const withRequest = new Set(open.map((r) => r.orderId))
      return {
        orders: rows.map((o) => ({
          number: o.number,
          status: o.status,
          placedAt: o.placedAt.toISOString(),
          email: o.email,
          customerName: o.shippingName,
          total: o.total,
          itemCount: o.items.reduce((a, i) => a + i.quantity, 0),
          shippingCity: o.shippingCity,
          trackingNumber: o.trackingNumber,
          shipmentStatus: o.shipment?.status ?? null,
          hasRequest: withRequest.has(o.id),
        })),
        total,
        counts: Object.fromEntries(ORDER_STATUSES.map((s) => [s, byStatus.find((r) => r.status === s)?.n ?? 0])),
      }
    },
  )

  app.get(
    '/admin/orders/export.csv',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Orders as a spreadsheet (CSV)',
        description: 'Same filters as the order queue, every matching order (up to 10,000). Amounts in rupees.',
        querystring: filterSchema,
      },
    },
    async (request, reply) => {
      const rows = await db.query.orders.findMany({
        where: orderFilter(request.query),
        with: { items: true, payments: true },
        orderBy: desc(orders.placedAt),
        limit: 10_000,
      })
      const refunded = await refundedByOrder(rows.map((o) => o.id))
      const header = ['Order', 'Placed (UTC)', 'Paid (UTC)', 'Status', 'Customer', 'Email', 'Phone', 'City', 'State', 'PIN', 'Items', 'Subtotal', 'Discount', 'Coupon', 'Shipping', 'GST included', 'Total', 'Refunded', 'Payment method', 'Payment ID', 'Courier', 'Tracking']
      const lines = rows.map((o) => {
        const paid = o.payments.find((p) => p.status === 'captured' || p.status === 'refunded')
        return [
          o.number,
          o.placedAt.toISOString(),
          iso(o.paidAt),
          o.status,
          o.shippingName,
          o.email,
          o.shippingPhone,
          o.shippingCity,
          o.shippingState,
          o.shippingPostalCode,
          o.items.map((i) => `${i.productName} ${i.variantSize} x${i.quantity}`).join('; '),
          rupees(o.subtotal),
          rupees(o.discount),
          o.couponCode,
          rupees(o.shippingFee),
          rupees(o.tax),
          rupees(o.total),
          rupees(refunded.get(o.id) ?? 0),
          paid?.method ?? null,
          paid?.providerPaymentId ?? null,
          o.trackingCarrier,
          o.trackingNumber,
        ]
          .map(csvCell)
          .join(',')
      })
      const stamp = new Date().toISOString().slice(0, 10)
      return reply
        .header('content-type', 'text/csv; charset=utf-8')
        .header('content-disposition', `attachment; filename="elegant-sip-orders-${stamp}.csv"`)
        .send(`${BOM}${[header.join(','), ...lines].join('\r\n')}\r\n`)
    },
  )

  app.get(
    '/admin/orders/:number',
    {
      schema: {
        tags: ['Admin'],
        summary: 'The full order record',
        description: 'Everything staff need for one order: lines with prices, totals, payment, invoice number, customer account, addresses, any cancellation or return request, and staff notes.',
        params: z.object({ number: z.string().min(3).max(40) }),
        response: { 200: detailSchema, 404: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.number, request.params.number),
        with: { items: true, payments: true, invoice: { columns: { number: true } }, user: { columns: { id: true, name: true, email: true } } },
      })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      const [returnRequest, refunded, editable] = await Promise.all([
        db.query.returnRequests.findFirst({ where: eq(returnRequests.orderId, order.id) }),
        refundedByOrder([order.id]),
        addressEditable(order.id, order.status),
      ])
      // The captured payment if there is one, else the newest attempt.
      const payment =
        order.payments.find((p) => p.status === 'captured' || p.status === 'refunded') ??
        [...order.payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ??
        null
      const shipping = {
        name: order.shippingName,
        line1: order.shippingLine1,
        city: order.shippingCity,
        postalCode: order.shippingPostalCode,
        state: order.shippingState,
        country: order.shippingCountry,
      }
      return {
        number: order.number,
        status: order.status,
        placedAt: order.placedAt.toISOString(),
        paidAt: iso(order.paidAt),
        shippedAt: iso(order.shippedAt),
        cancelledAt: iso(order.cancelledAt),
        email: order.email,
        phone: order.shippingPhone,
        notes: order.notes,
        staffNotes: order.staffNotes,
        customer: order.user ?? null,
        items: order.items.map((i) => ({
          productSlug: i.productSlug,
          productName: i.productName,
          variantSize: i.variantSize,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        couponCode: order.couponCode,
        shippingMethod: order.shippingMethod,
        shippingFee: order.shippingFee,
        tax: order.tax,
        total: order.total,
        refunded: refunded.get(order.id) ?? 0,
        shipping,
        billing: order.billingName
          ? {
              name: order.billingName,
              line1: order.billingLine1 ?? '',
              city: order.billingCity ?? '',
              postalCode: order.billingPostalCode ?? '',
              state: order.billingState,
              country: order.billingCountry ?? 'India',
            }
          : shipping,
        tracking: order.trackingNumber || order.trackingCarrier ? { carrier: order.trackingCarrier, number: order.trackingNumber } : null,
        payment: payment
          ? {
              provider: payment.provider,
              status: payment.status,
              method: payment.method,
              amount: payment.amount,
              providerOrderId: payment.providerOrderId,
              providerPaymentId: payment.providerPaymentId,
              capturedAt: iso(payment.capturedAt),
            }
          : null,
        invoiceNumber: order.invoice?.number ?? null,
        returnRequest: returnRequest
          ? {
              id: returnRequest.id,
              type: returnRequest.type,
              status: returnRequest.status,
              reason: returnRequest.reason,
              staffNote: returnRequest.staffNote,
              requestedAt: returnRequest.requestedAt.toISOString(),
            }
          : null,
        addressEditable: editable,
      }
    },
  )

  app.put(
    '/admin/orders/:number/staff-notes',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Replace the internal staff notes on an order',
        description: 'Staff-only; never shown to the customer. An empty string clears them.',
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z.object({ staffNotes: z.string().trim().max(2000) }),
        response: { 200: z.object({ staffNotes: z.string().nullable() }), 404: problemSchema },
      },
    },
    async (request) => {
      const value = request.body.staffNotes || null
      const rows = await db.update(orders).set({ staffNotes: value }).where(eq(orders.number, request.params.number)).returning({ id: orders.id })
      if (rows.length === 0) throw ApiError.notFound(`Order ${request.params.number}`)
      return { staffNotes: value }
    },
  )

  app.patch(
    '/admin/orders/:number/address',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Correct the delivery address or phone',
        description:
          'Only before the parcel is booked with a courier or shipped — after that the courier holds the address. The GST place of supply on an issued invoice is not changed.',
        params: z.object({ number: z.string().min(3).max(40) }),
        body: z
          .object({
            name: z.string().trim().min(2).max(120),
            line1: z.string().trim().min(3).max(300),
            city: z.string().trim().min(2).max(80),
            postalCode: z.string().trim().regex(/^\d{6}$/, 'A 6-digit PIN code'),
            state: z.string().trim().max(80).nullable(),
            phone: z.string().trim().regex(/^\+?[\d\s-]{10,16}$/, 'A phone number').nullable(),
          })
          .partial()
          .refine((b) => Object.keys(b).length > 0, 'Nothing to change.'),
        response: { 200: z.object({ ok: z.literal(true) }), 400: problemSchema, 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number), columns: { id: true, status: true } })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      if (!(await addressEditable(order.id, order.status))) {
        throw ApiError.conflict(
          'address_locked',
          'This parcel is already booked with the courier or on its way. Change the address with the courier (or cancel the booking first).',
        )
      }
      const b = request.body
      await db
        .update(orders)
        .set({
          ...(b.name !== undefined ? { shippingName: b.name } : {}),
          ...(b.line1 !== undefined ? { shippingLine1: b.line1 } : {}),
          ...(b.city !== undefined ? { shippingCity: b.city } : {}),
          ...(b.postalCode !== undefined ? { shippingPostalCode: b.postalCode } : {}),
          ...(b.state !== undefined ? { shippingState: b.state || null } : {}),
          ...(b.phone !== undefined ? { shippingPhone: b.phone || null } : {}),
        })
        .where(eq(orders.id, order.id))
      return { ok: true as const }
    },
  )

  app.post(
    '/admin/orders/:number/resend-confirmation',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Email the order confirmation to the customer again',
        params: z.object({ number: z.string().min(3).max(40) }),
        response: { 200: z.object({ delivered: z.boolean() }), 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number), columns: { id: true, status: true } })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      if (!['paid', 'packed', 'shipped', 'delivered'].includes(order.status)) {
        throw ApiError.conflict('not_confirmed', 'Only a paid order that is still going ahead has a confirmation to resend.')
      }
      const result = await sendOrderConfirmation(order.id)
      return { delivered: result?.delivered ?? false }
    },
  )
}

/** Exposed for the customer and report routes. */
export { refundedByOrder }
