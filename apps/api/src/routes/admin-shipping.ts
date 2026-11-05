import { eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { ApiError } from '../lib/problem.js'
import { bookShipment, cancelShipment, courierRates, syncShipment, toShipmentView } from '../lib/fulfilment.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin courier booking (Shiprocket). Registered inside adminRoutes, so every
 * route here inherits the staff-only hook and the audit log.
 * ──────────────────────────────────────────────────────────────────────────── */

const eventSchema = z.object({ at: z.string(), status: z.string(), location: z.string().nullable(), detail: z.string().nullable() })

export const shipmentViewSchema = z.object({
  provider: z.string(),
  status: z.string(),
  providerStatus: z.string().nullable(),
  awb: z.string().nullable(),
  courierName: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  labelUrl: z.string().nullable(),
  weightGrams: z.number().int(),
  pickupScheduledAt: z.string().nullable(),
  expectedDeliveryAt: z.string().nullable(),
  deliveredAt: z.string().nullable(),
  lastError: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
  events: z.array(eventSchema),
})

const params = z.object({ number: z.string().min(3).max(40) })
const shipmentResponse = z.object({ shipment: shipmentViewSchema })
const errors = { 400: problemSchema, 404: problemSchema, 409: problemSchema, 502: problemSchema }

export const adminShippingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/orders/:number/shipment',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Courier shipment for an order',
        params,
        response: {
          200: z.object({
            provider: z.string(),
            phone: z.string().nullable(),
            shipment: shipmentViewSchema.nullable(),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({
        where: eq(orders.number, request.params.number),
        with: { shipment: true },
      })
      if (!order) throw ApiError.notFound(`Order ${request.params.number}`)
      return {
        provider: env.SHIPPING_PROVIDER,
        phone: order.shippingPhone ?? order.billingPhone,
        shipment: order.shipment ? toShipmentView(order.shipment) : null,
      }
    },
  )

  app.get(
    '/admin/orders/:number/shipment/couriers',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Courier options and rates for this parcel',
        params,
        response: {
          200: z.object({
            weightGrams: z.number().int(),
            recommendedCourierId: z.number().int().nullable(),
            couriers: z.array(
              z.object({
                courierId: z.number().int(),
                courierName: z.string(),
                rate: paiseSchema,
                estimatedDays: z.number().nullable(),
                etd: z.string().nullable(),
                rating: z.number().nullable(),
              }),
            ),
          }),
          ...errors,
        },
      },
    },
    async (request) => courierRates(request.params.number),
  )

  app.post(
    '/admin/orders/:number/shipment',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Book the courier',
        description:
          'Creates the Shiprocket order, assigns an AWB (with `courierId`, or Shiprocket\'s recommendation), schedules pickup and fetches the label. Retrying after a failure continues from the failed step. `phone` fills in a missing customer mobile number.',
        params,
        body: z.object({
          courierId: z.number().int().positive().optional(),
          phone: z.string().trim().max(20).optional(),
        }),
        response: { 200: shipmentResponse, ...errors },
      },
    },
    async (request) => ({ shipment: await bookShipment(request.params.number, request.body, request.log) }),
  )

  app.post(
    '/admin/orders/:number/shipment/sync',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Refresh tracking from the courier',
        params,
        response: { 200: shipmentResponse, ...errors },
      },
    },
    async (request) => ({ shipment: await syncShipment(request.params.number, request.log) }),
  )

  app.post(
    '/admin/orders/:number/shipment/cancel',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Cancel a shipment before pickup',
        params,
        response: { 200: shipmentResponse, ...errors },
      },
    },
    async (request) => ({ shipment: await cancelShipment(request.params.number, request.log) }),
  )
}
