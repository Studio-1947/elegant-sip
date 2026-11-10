import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { normaliseIndianMobile } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, shipments, type ShipmentEvent } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { sendEmail } from './email.js'
import { ApiError } from './problem.js'
import {
  getShippingProvider,
  ShippingProviderError,
  type ShippingProvider,
  type TrackingResult,
} from './shipping.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Fulfilment: turning a paid order into a courier shipment, and courier
 * updates back into order status.
 *
 * Booking is a chain of provider calls (order → AWB → pickup → label). Each
 * result is saved as soon as it returns, so a failure part-way leaves a row
 * that a retry continues from instead of booking a second shipment.
 * ──────────────────────────────────────────────────────────────────────────── */

export type ShipmentStatus =
  | 'created'
  | 'awb_assigned'
  | 'pickup_scheduled'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'
  | 'rto'
  | 'cancelled'

type ShipmentRow = typeof shipments.$inferSelect
type OrderRow = typeof orders.$inferSelect

/** "250 g" → 250, "1 kg" → 1000. Unknown sizes count as 250 g rather than zero. */
export function packGrams(size: string): number {
  const match = size.trim().toLowerCase().match(/^([\d.]+)\s*(kg|g)$/)
  if (!match) return 250
  const value = Number(match[1])
  return Math.round(match[2] === 'kg' ? value * 1000 : value)
}

/** Indian mobile as 10 digits, accepting +91 / 0 prefixes and spaces. */
export const normalisePhone = (phone: string | null | undefined): string | null => normaliseIndianMobile(phone)

/** Maps a courier's free-text status onto our small set. Null = no change. */
export function normaliseCourierStatus(raw: string | null | undefined): ShipmentStatus | null {
  if (!raw) return null
  const s = raw.toUpperCase().replace(/[_-]+/g, ' ').trim()
  if (s.includes('RTO')) return 'rto'
  if (s.includes('CANCEL')) return 'cancelled'
  if (s === 'DELIVERED') return 'delivered'
  if (s.includes('OUT FOR DELIVERY')) return 'out_for_delivery'
  if (/UNDELIVERED|LOST|DAMAGED|DESTROYED|EXCEPTION|DISPOSED/.test(s)) return 'exception'
  if (/PICKUP|AWB ASSIGNED|LABEL GENERATED|MANIFEST/.test(s) && !s.includes('PICKED UP')) return 'pickup_scheduled'
  if (/PICKED UP|IN TRANSIT|SHIPPED|REACHED|DESTINATION|ORIGIN|HUB|DELAYED/.test(s)) return 'in_transit'
  return null
}

const IN_MOTION: ShipmentStatus[] = ['in_transit', 'out_for_delivery', 'delivered']

/** Forward progress of a healthy parcel. Side states (exception, rto, cancelled) sit outside it. */
const PROGRESS: ShipmentStatus[] = ['created', 'awb_assigned', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered']

/**
 * Courier reports arrive late and out of order (a webhook retry, or a tracking
 * lookup that lags the webhook). A stale report must never move a parcel
 * backwards, and nothing reopens a delivered one.
 */
export function nextShipmentStatus(current: string, reported: ShipmentStatus | null): string {
  if (!reported || current === 'delivered') return current
  const from = PROGRESS.indexOf(current as ShipmentStatus)
  const to = PROGRESS.indexOf(reported)
  if (from !== -1 && to !== -1 && to < from) return current
  return reported
}

export interface ShipmentView {
  provider: string
  status: string
  providerStatus: string | null
  awb: string | null
  courierName: string | null
  trackingUrl: string | null
  labelUrl: string | null
  weightGrams: number
  pickupScheduledAt: string | null
  expectedDeliveryAt: string | null
  deliveredAt: string | null
  lastError: string | null
  lastSyncedAt: string | null
  events: ShipmentEvent[]
}

export const toShipmentView = (row: ShipmentRow): ShipmentView => ({
  provider: row.provider,
  status: row.status,
  providerStatus: row.providerStatus,
  awb: row.awb,
  courierName: row.courierName,
  trackingUrl: row.trackingUrl,
  labelUrl: row.labelUrl,
  weightGrams: row.weightGrams,
  pickupScheduledAt: row.pickupScheduledAt?.toISOString() ?? null,
  expectedDeliveryAt: row.expectedDeliveryAt?.toISOString() ?? null,
  deliveredAt: row.deliveredAt?.toISOString() ?? null,
  lastError: row.lastError,
  lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
  events: row.events,
})

function requireProvider(): ShippingProvider {
  const provider = getShippingProvider()
  if (!provider) {
    throw ApiError.conflict('shipping_not_configured', 'Courier booking is off (SHIPPING_PROVIDER=manual). Add tracking by hand instead.')
  }
  return provider
}

const providerFailure = (err: unknown) =>
  new ApiError(
    502,
    'courier_error',
    'Courier request failed',
    err instanceof ShippingProviderError ? err.message : 'The courier service could not be reached. Try again shortly.',
  )

async function loadOrder(orderNumber: string) {
  const order = await db.query.orders.findFirst({
    where: eq(orders.number, orderNumber),
    with: { items: true, shipment: true },
  })
  if (!order) throw ApiError.notFound(`Order ${orderNumber}`)
  return order
}

const weightFor = (items: { variantSize: string; quantity: number }[]) =>
  items.reduce((sum, item) => sum + packGrams(item.variantSize) * item.quantity, 0) + env.SHIP_PACKAGING_WEIGHT_GRAMS

export async function courierRates(orderNumber: string) {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  const weightGrams = weightFor(order.items)
  try {
    const result = await provider.courierOptions({
      deliveryPostcode: order.shippingPostalCode,
      weightGrams,
      declaredValue: order.subtotal - order.discount,
    })
    return { ...result, weightGrams }
  } catch (err) {
    throw providerFailure(err)
  }
}

const updateShipment = async (id: string, values: Partial<typeof shipments.$inferInsert>) => {
  const [row] = await db
    .update(shipments)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(shipments.id, id))
    .returning()
  return row
}

/**
 * Books (or finishes booking) the courier for a paid order. Safe to call again
 * after a failure: completed steps are skipped.
 */
export async function bookShipment(
  orderNumber: string,
  options: { courierId?: number; phone?: string },
  log: FastifyBaseLogger,
): Promise<ShipmentView> {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  if (!['paid', 'packed'].includes(order.status)) {
    throw ApiError.conflict('order_not_shippable', `A ${order.status.replaceAll('_', ' ')} order cannot be shipped.`)
  }

  const suppliedPhone = options.phone !== undefined ? normalisePhone(options.phone) : null
  if (options.phone !== undefined && !suppliedPhone) throw ApiError.badRequest('Enter a valid 10-digit Indian mobile number.')
  const phone = suppliedPhone ?? normalisePhone(order.shippingPhone) ?? normalisePhone(order.billingPhone)
  if (!phone) {
    throw ApiError.conflict('phone_required', 'Couriers need the customer\'s mobile number. Add it to book this shipment.')
  }
  if (suppliedPhone && suppliedPhone !== order.shippingPhone) {
    await db.update(orders).set({ shippingPhone: suppliedPhone }).where(eq(orders.id, order.id))
  }
  const state = order.shippingState ?? order.billingState
  if (!state) throw ApiError.conflict('state_required', 'The delivery address has no state, which couriers require.')

  // Start fresh after a cancellation; otherwise continue the existing booking.
  let row = order.shipment
  const weightGrams = weightFor(order.items)
  if (!row) {
    ;[row] = await db.insert(shipments).values({ orderId: order.id, provider: provider.name, weightGrams }).returning()
  } else if (row.status === 'cancelled' || row.provider !== provider.name) {
    row = await updateShipment(row.id, {
      provider: provider.name,
      providerOrderId: null,
      providerShipmentId: null,
      awb: null,
      courierId: null,
      courierName: null,
      status: 'created',
      providerStatus: null,
      labelUrl: null,
      trackingUrl: null,
      pickupScheduledAt: null,
      expectedDeliveryAt: null,
      deliveredAt: null,
      lastError: null,
      events: [],
      weightGrams,
    })
  }

  const fail = async (step: string, err: unknown): Promise<never> => {
    log.error({ err, orderNumber, step }, 'courier booking step failed')
    const message = err instanceof ShippingProviderError ? err.message : `${step} failed`
    await updateShipment(row!.id, { lastError: message })
    throw providerFailure(err)
  }

  if (!row.providerShipmentId) {
    const contact = { phone, email: order.email }
    try {
      const created = await provider.createOrder({
        orderNumber: order.number,
        orderDate: order.placedAt,
        shipping: {
          name: order.shippingName,
          line1: order.shippingLine1,
          city: order.shippingCity,
          postalCode: order.shippingPostalCode,
          state,
          country: order.shippingCountry,
          ...contact,
        },
        billing: {
          name: order.billingName ?? order.shippingName,
          line1: order.billingLine1 ?? order.shippingLine1,
          city: order.billingCity ?? order.shippingCity,
          postalCode: order.billingPostalCode ?? order.shippingPostalCode,
          state: order.billingState ?? state,
          country: order.billingCountry ?? order.shippingCountry,
          ...contact,
          phone: normalisePhone(order.billingPhone) ?? phone,
        },
        items: order.items.map((item) => ({
          name: `${item.productName} (${item.variantSize})`,
          sku: item.sku,
          units: item.quantity,
          unitPrice: item.unitPrice,
        })),
        subtotal: order.subtotal,
        discount: order.discount,
        shippingFee: order.shippingFee,
        weightGrams,
      })
      row = await updateShipment(row.id, { ...created, lastError: null })
    } catch (err) {
      await fail('Creating the courier order', err)
    }
  }

  if (!row.awb) {
    try {
      const assigned = await provider.assignAwb(row.providerShipmentId!, options.courierId)
      row = await updateShipment(row.id, {
        ...assigned,
        trackingUrl: provider.publicTrackingUrl(assigned.awb),
        status: 'awb_assigned',
        lastError: null,
      })
      await db
        .update(orders)
        .set({ trackingNumber: assigned.awb, trackingCarrier: assigned.courierName, ...(order.status === 'paid' ? { status: 'packed' } : {}) })
        .where(eq(orders.id, order.id))
    } catch (err) {
      await fail('Assigning an AWB', err)
    }
  }

  if (!row.pickupScheduledAt) {
    try {
      const pickup = await provider.requestPickup(row.providerShipmentId!)
      row = await updateShipment(row.id, {
        pickupScheduledAt: pickup.scheduledAt ? new Date(pickup.scheduledAt) : new Date(),
        status: row.status === 'awb_assigned' ? 'pickup_scheduled' : row.status,
        lastError: null,
      })
    } catch (err) {
      await fail('Scheduling the pickup', err)
    }
  }

  if (!row.labelUrl) {
    // A missing label never blocks the shipment; staff can download it from Shiprocket.
    try {
      const labelUrl = await provider.label(row.providerShipmentId!)
      if (labelUrl) row = await updateShipment(row.id, { labelUrl })
    } catch (err) {
      log.warn({ err, orderNumber }, 'shipping label not generated')
    }
  }

  return toShipmentView(row)
}

/** Applies a courier status report (from a webhook or a manual sync). */
export async function applyTracking(
  row: ShipmentRow,
  update: TrackingResult,
  log: FastifyBaseLogger,
): Promise<ShipmentRow> {
  const normalised = normaliseCourierStatus(update.providerStatus)
  // Merge scans by timestamp + status so repeated reports never duplicate history.
  const seen = new Set(row.events.map((event) => `${event.at}|${event.status}`))
  const merged = [...row.events]
  for (const scan of update.scans) {
    const key = `${scan.at}|${scan.status}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(scan)
    }
  }
  merged.sort((a, b) => a.at.localeCompare(b.at))

  const status = nextShipmentStatus(row.status, normalised)
  const stale = normalised !== null && status !== normalised
  // Shipments booked before the link was saved at booking time still get one.
  const provider = getShippingProvider()
  const fallbackUrl = row.awb && provider?.name === row.provider ? provider.publicTrackingUrl(row.awb) : null
  const updated = await updateShipment(row.id, {
    status,
    providerStatus: stale ? row.providerStatus : (update.providerStatus ?? row.providerStatus),
    trackingUrl: update.trackingUrl ?? row.trackingUrl ?? fallbackUrl,
    expectedDeliveryAt: update.expectedDeliveryAt ? new Date(update.expectedDeliveryAt) : row.expectedDeliveryAt,
    deliveredAt: status === 'delivered' ? (row.deliveredAt ?? new Date()) : row.deliveredAt,
    events: merged,
    lastSyncedAt: new Date(),
  })

  if (IN_MOTION.includes(status as ShipmentStatus)) {
    // Conditional transitions: never move an order backwards or revive a cancelled one.
    const shipped = await db
      .update(orders)
      .set({ status: 'shipped', shippedAt: new Date(), trackingNumber: updated.awb, trackingCarrier: updated.courierName })
      .where(and(eq(orders.id, row.orderId), inArray(orders.status, ['paid', 'packed'])))
      .returning()
    if (shipped[0] && updated.awb) {
      await sendShippedEmail(shipped[0], updated.courierName, updated.awb, updated.trackingUrl).catch((err) =>
        log.error({ err, orderNumber: shipped[0].number }, 'shipped email failed'),
      )
    }
  }
  if (status === 'delivered') {
    await db
      .update(orders)
      .set({ status: 'delivered' })
      .where(and(eq(orders.id, row.orderId), inArray(orders.status, ['paid', 'packed', 'shipped'])))
  }
  return updated
}

export async function syncShipment(orderNumber: string, log: FastifyBaseLogger): Promise<ShipmentView> {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  if (!order.shipment?.awb) throw ApiError.conflict('no_shipment', 'This order has no booked shipment to track.')
  let result: TrackingResult
  try {
    result = await provider.track(order.shipment.awb)
  } catch (err) {
    throw providerFailure(err)
  }
  return toShipmentView(await applyTracking(order.shipment, result, log))
}

/** Parcels that can still change. Delivered and cancelled ones are final. */
const OPEN_STATUSES: ShipmentStatus[] = ['awb_assigned', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'exception', 'rto']

/**
 * Background safety net for missed webhooks: refreshes open shipments that
 * have not heard from the courier for `staleMinutes`. Webhook updates also set
 * `lastSyncedAt`, so a healthy webhook means this rarely calls the courier.
 */
export async function syncStaleShipments(staleMinutes: number, log: FastifyBaseLogger, limit = 50): Promise<number> {
  const provider = getShippingProvider()
  if (!provider) return 0
  const now = Date.now()
  const rows = await db.query.shipments.findMany({
    where: and(
      eq(shipments.provider, provider.name),
      inArray(shipments.status, OPEN_STATUSES),
      isNotNull(shipments.awb),
      // Stop chasing parcels after 30 days; anything that old needs a person.
      gt(shipments.createdAt, new Date(now - 30 * 24 * 60 * 60 * 1000)),
      or(isNull(shipments.lastSyncedAt), lt(shipments.lastSyncedAt, new Date(now - staleMinutes * 60_000))),
    ),
    // Never-synced parcels first, then the longest-silent ones.
    orderBy: sql`${shipments.lastSyncedAt} asc nulls first`,
    limit,
  })
  let synced = 0
  for (const row of rows) {
    try {
      await applyTracking(row, await provider.track(row.awb!), log)
      synced += 1
    } catch (err) {
      // One bad AWB must not stop the rest; the next run retries it.
      log.warn({ err, awb: row.awb }, 'background shipment sync failed')
    }
  }
  return synced
}

export async function cancelShipment(orderNumber: string, log: FastifyBaseLogger): Promise<ShipmentView> {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  const row = order.shipment
  if (!row || row.status === 'cancelled') throw ApiError.conflict('no_shipment', 'There is no active shipment to cancel.')
  if (IN_MOTION.includes(row.status as ShipmentStatus)) {
    throw ApiError.conflict('shipment_in_transit', 'The parcel is already with the courier. Cancel it from Shiprocket as a return instead.')
  }
  if (row.providerOrderId) {
    try {
      await provider.cancel(row.providerOrderId)
    } catch (err) {
      log.error({ err, orderNumber }, 'courier cancellation failed')
      throw providerFailure(err)
    }
  }
  await db.update(orders).set({ trackingNumber: null, trackingCarrier: null }).where(eq(orders.id, order.id))
  return toShipmentView(await updateShipment(row.id, { status: 'cancelled', lastError: null }))
}

/** The customer's "on its way" message. Sent once, when the courier first moves the parcel. */
export async function sendShippedEmail(
  order: Pick<OrderRow, 'email' | 'number' | 'shippingName'>,
  carrier: string | null,
  tracking: string,
  trackingUrl?: string | null,
) {
  return sendEmail({
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
      ...(trackingUrl ? ([['Track online', trackingUrl]] as [string, string][]) : []),
    ],
    action: { label: 'Track your order', url: `${env.SITE_URL}/order/${encodeURIComponent(order.number)}` },
  })
}
