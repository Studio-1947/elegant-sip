import { and, desc, eq, gte, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { invoices, orderItems, orders, refunds } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { dayEnd, dayStart } from './admin-orders.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — sales report.
 *
 * Sales are counted when paid (`paidAt`), whatever happened afterwards; money
 * given back is counted when the refund was processed. Net = gross − refunds.
 * GST comes from the invoices issued in the period, split as on the invoices.
 * Days are India days.
 * ──────────────────────────────────────────────────────────────────────────── */

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const istDay = (d: Date) => new Date(d.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)

export const adminReportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/reports/sales',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Sales, refunds, GST and best sellers for a period',
        description: 'Defaults to the last 30 days, today included. At most 366 days.',
        querystring: z.object({ from: daySchema.optional(), to: daySchema.optional() }),
        response: {
          200: z.object({
            from: z.string(),
            to: z.string(),
            orders: z.number().int(),
            units: z.number().int(),
            gross: paiseSchema,
            subtotal: paiseSchema,
            discount: paiseSchema,
            shipping: paiseSchema,
            tax: paiseSchema,
            refunds: paiseSchema,
            net: paiseSchema,
            averageOrder: paiseSchema,
            gst: z.object({ invoices: z.number().int(), cgst: paiseSchema, sgst: paiseSchema, igst: paiseSchema }),
            byDay: z.array(z.object({ day: z.string(), orders: z.number().int(), gross: paiseSchema })),
            topProducts: z.array(z.object({ productSlug: z.string(), productName: z.string(), units: z.number().int(), revenue: paiseSchema })),
          }),
          400: problemSchema,
        },
      },
    },
    async (request) => {
      const to = request.query.to ?? istDay(new Date())
      const from = request.query.from ?? istDay(new Date(dayStart(to).getTime() - 29 * 24 * 60 * 60 * 1000))
      const start = dayStart(from)
      const end = dayEnd(to)
      if (end <= start) throw ApiError.badRequest('The start day must be on or before the end day.')
      if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) throw ApiError.badRequest('Choose a period of at most a year.')

      const paidInPeriod = and(isNotNull(orders.paidAt), gte(orders.paidAt, start), lt(orders.paidAt, end))
      const [paid, [refunded], [gst], top] = await Promise.all([
        db
          .select({ id: orders.id, paidAt: orders.paidAt, status: orders.status, subtotal: orders.subtotal, discount: orders.discount, shippingFee: orders.shippingFee, tax: orders.tax, total: orders.total })
          .from(orders)
          .where(paidInPeriod),
        db
          .select({ total: sql<number>`coalesce(sum(${refunds.amount}), 0)::int` })
          .from(refunds)
          .where(and(eq(refunds.status, 'processed'), gte(refunds.processedAt, start), lt(refunds.processedAt, end))),
        db
          .select({
            invoices: sql<number>`count(*)::int`,
            cgst: sql<number>`coalesce(sum(${invoices.cgst}), 0)::int`,
            sgst: sql<number>`coalesce(sum(${invoices.sgst}), 0)::int`,
            igst: sql<number>`coalesce(sum(${invoices.igst}), 0)::int`,
          })
          .from(invoices)
          .where(and(gte(invoices.issuedAt, start), lt(invoices.issuedAt, end))),
        // Best sellers among the period's sales that were not cancelled.
        db
          .select({
            productSlug: orderItems.productSlug,
            productName: sql<string>`max(${orderItems.productName})`,
            units: sql<number>`sum(${orderItems.quantity})::int`,
            revenue: sql<number>`sum(${orderItems.lineTotal})::int`,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orderItems.orderId, orders.id))
          .where(and(paidInPeriod, ne(orders.status, 'cancelled')))
          .groupBy(orderItems.productSlug)
          .orderBy(desc(sql`sum(${orderItems.lineTotal})`))
          .limit(10),
      ])
      const sum = (pick: (o: (typeof paid)[number]) => number) => paid.reduce((a, o) => a + pick(o), 0)
      const gross = sum((o) => o.total)
      const units = paid.length
        ? await db
            .select({ n: sql<number>`coalesce(sum(${orderItems.quantity}), 0)::int` })
            .from(orderItems)
            .where(inArray(orderItems.orderId, paid.map((o) => o.id)))
            .then((rows) => rows[0].n)
        : 0

      const days = new Map<string, { orders: number; gross: number }>()
      for (let t = start.getTime(); t < end.getTime(); t += 24 * 60 * 60 * 1000) days.set(istDay(new Date(t)), { orders: 0, gross: 0 })
      for (const o of paid) {
        const day = days.get(istDay(o.paidAt!))
        if (day) {
          day.orders += 1
          day.gross += o.total
        }
      }

      return {
        from,
        to,
        orders: paid.length,
        units,
        gross,
        subtotal: sum((o) => o.subtotal),
        discount: sum((o) => o.discount),
        shipping: sum((o) => o.shippingFee),
        tax: sum((o) => o.tax),
        refunds: refunded.total,
        net: Math.max(0, gross - refunded.total),
        averageOrder: paid.length ? Math.round(gross / paid.length) : 0,
        gst,
        byDay: [...days].map(([day, v]) => ({ day, ...v })),
        topProducts: top,
      }
    },
  )
}
