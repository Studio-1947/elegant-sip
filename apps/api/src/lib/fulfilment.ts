import { and, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { normaliseIndianMobile } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, shipments, type ShipmentEvent } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { alertStaff } from './alerts.js'
import { sendEmail } from './email.js'
import { ApiError } from './problem.js'
import {
  getShippingProvider,
  ShippingProviderError,
  type AssignedAwb,
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
 *
 * Provider calls can take well over a minute, so no transaction is held
 * across them. Instead a booking (or a cancellation) takes a lease on the
 * shipment row (`booking_started_at`); a second request meanwhile gets a 409
 * rather than booking the parcel twice.
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
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

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
  const s = raw.toUpperCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  // Every return stage is rto, including "RTO DELIVERED" (back with us).
  if (/\bRTO\b/.test(s)) return 'rto'
  // A cancellation request is not a cancellation; the courier confirms with CANCELED.
  if (s.includes('CANCELLATION')) return null
  if (/\bCANCELL?ED\b/.test(s)) return 'cancelled'
  if (s === 'DELIVERED') return 'delivered'
  if (s.includes('OUT FOR DELIVERY')) return 'out_for_delivery'
  if (/UNDELIVERED|LOST|DAMAGED|DESTROYED|EXCEPTION|DISPOSED|UNTRACEABLE/.test(s)) return 'exception'
  if (/PICKUP|AWB ASSIGNED|LABEL GENERATED|MANIFEST/.test(s) && !s.includes('PICKED UP')) return 'pickup_scheduled'
  if (/PICKED UP|IN TRANSIT|SHIPPED|REACHED|DESTINATION|ORIGIN|HUB|DELAYED/.test(s)) return 'in_transit'
  return null
}

const IN_MOTION: ShipmentStatus[] = ['in_transit', 'out_for_delivery', 'delivered']
/** Booked but not yet with the courier, so it can still be cancelled there. */
const BEFORE_PICKUP: ShipmentStatus[] = ['created', 'awb_assigned', 'pickup_scheduled']
/** Staff are emailed when a parcel first reaches one of these. */
const NEEDS_ATTENTION: ShipmentStatus[] = ['exception', 'rto']

/** Forward progress of a healthy parcel. Side states (exception, rto, cancelled) sit outside it. */
const PROGRESS: ShipmentStatus[] = ['created', 'awb_assigned', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered']

/**
 * Courier reports arrive late and out of order (a webhook retry, or a tracking
 * lookup that lags the webhook). A stale report must never move a parcel
 * backwards. Delivered and cancelled are final, and a parcel returning to
 * origin stays rto: a late forward scan must not make it look outbound again.
 */
export function nextShipmentStatus(current: string, reported: ShipmentStatus | null): string {
  if (!reported || current === 'delivered' || current === 'cancelled' || current === 'rto') return current
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

/**
 * Couriers bill the greater of actual and volumetric weight (L×B×H cm / 5000
 * = kg, i.e. / 5 = grams), so quotes use it too. A light parcel in the
 * default box bills on its size.
 */
export const chargeableGrams = (actualGrams: number) =>
  Math.max(actualGrams, Math.ceil((env.SHIP_PACKAGE_LENGTH_CM * env.SHIP_PACKAGE_BREADTH_CM * env.SHIP_PACKAGE_HEIGHT_CM) / 5))

export async function courierRates(orderNumber: string) {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  const weightGrams = weightFor(order.items)
  try {
    const result = await provider.courierOptions({
      deliveryPostcode: order.shippingPostalCode,
      weightGrams: chargeableGrams(weightGrams),
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

/* ── Booking lease ────────────────────────────────────────────────────────── */

/** A booking spends up to a couple of minutes at the courier; an older lease belongs to a request that died. */
const BOOKING_LEASE_MS = 5 * 60_000

const bookingInProgress = () =>
  ApiError.conflict('booking_in_progress', 'A courier booking for this order is already in progress. Wait a minute, then reload.')

const leaseHeld = (row: ShipmentRow) => row.bookingStartedAt !== null && row.bookingStartedAt.getTime() > Date.now() - BOOKING_LEASE_MS

/** Takes the lease with a conditional update; 409 while someone else holds it. */
async function takeLease(shipmentId: string): Promise<Date> {
  const at = new Date()
  const [taken] = await db
    .update(shipments)
    .set({ bookingStartedAt: at })
    .where(
      and(
        eq(shipments.id, shipmentId),
        or(isNull(shipments.bookingStartedAt), lt(shipments.bookingStartedAt, new Date(at.getTime() - BOOKING_LEASE_MS))),
      ),
    )
    .returning({ id: shipments.id })
  if (!taken) throw bookingInProgress()
  return at
}

/** Releases only our own lease, never one taken over after ours went stale. */
const releaseLease = (shipmentId: string, at: Date) =>
  db.update(shipments).set({ bookingStartedAt: null }).where(and(eq(shipments.id, shipmentId), eq(shipments.bookingStartedAt, at)))

/** Shiprocket's order_id. The first booking keeps the plain order number; each rebooking needs a new one. */
export const providerOrderRef = (orderNumber: string, attempt: number) => (attempt <= 1 ? orderNumber : `${orderNumber}-${attempt}`)

const nextAttempt = (row: ShipmentRow) => Math.max(row.bookingAttempt, 1) + 1

const SHIPPABLE = ['paid', 'packed']
const notShippable = (status: string) =>
  ApiError.conflict('order_not_shippable', `A ${status.replaceAll('_', ' ')} order cannot be shipped.`)

/**
 * Creates or reopens the shipment row and takes its lease. The order row is
 * locked first, as cancelling an order does, so a booking can never start on
 * an order that is being cancelled.
 */
async function claimBooking(orderId: string, providerName: string, weightGrams: number): Promise<ShipmentRow> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.status }).from(orders).where(eq(orders.id, orderId)).for('update')
    if (!order || !SHIPPABLE.includes(order.status)) throw notShippable(order?.status ?? 'missing')
    const [existing] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).for('update')
    const at = new Date()
    if (!existing) {
      const [created] = await tx
        .insert(shipments)
        .values({ orderId, provider: providerName, weightGrams, bookingAttempt: 1, bookingStartedAt: at })
        .returning()
      return created
    }
    if (leaseHeld(existing)) throw bookingInProgress()
    // Start fresh after a cancellation; otherwise continue the existing booking.
    const fresh = existing.status === 'cancelled' || existing.provider !== providerName
    const [claimed] = await tx
      .update(shipments)
      .set({
        bookingStartedAt: at,
        updatedAt: at,
        ...(fresh
          ? {
              provider: providerName,
              bookingAttempt: nextAttempt(existing),
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
            }
          : {}),
      })
      .where(eq(shipments.id, existing.id))
      .returning()
    return claimed
  })
}

/*
 * Shiprocket's wording when a retry repeats a step whose reply was lost
 * ("Already in Pickup Queue.", "AWB is already assigned"). Matched loosely,
 * since the exact text is not documented; anything else is still a failure.
 */
const AWB_ALREADY = /\balready\s+(been\s+)?assigned\b/i
const PICKUP_ALREADY = /\balready\s+(in\s+(the\s+)?pickup\s+queue|(been\s+)?(scheduled|generated|requested))\b/i
const saysAlready = (err: unknown, pattern: RegExp) => err instanceof ShippingProviderError && pattern.test(err.message)

const markPickup = async (id: string, scheduledAt: string | null) => {
  const [row] = await db
    .update(shipments)
    .set({
      pickupScheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      // In SQL, so a courier scan that landed meanwhile is not overwritten.
      status: sql`CASE WHEN ${shipments.status} = 'awb_assigned' THEN 'pickup_scheduled' ELSE ${shipments.status} END`,
      lastError: null,
      updatedAt: new Date(),
    })
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
  if (!SHIPPABLE.includes(order.status)) throw notShippable(order.status)

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

  const weightGrams = weightFor(order.items)
  let row = await claimBooking(order.id, provider.name, weightGrams)
  const lease = row.bookingStartedAt!
  try {
    const fail = async (step: string, err: unknown): Promise<never> => {
      log.error({ err, orderNumber, step }, 'courier booking step failed')
      const message = err instanceof ShippingProviderError ? err.message : `${step} failed`
      await updateShipment(row.id, { lastError: message })
      throw providerFailure(err)
    }

    if (!row.providerShipmentId) {
      const contact = { phone, email: order.email }
      try {
        const created = await provider.createOrder({
          orderNumber: providerOrderRef(order.number, row.bookingAttempt),
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
        /* Unless Shiprocket plainly rejected the request (4xx), it may have
           created the order before the reply was lost. The retry then sends a
           new order_id rather than colliding with that one; the orphan has no
           AWB, so it costs nothing and can be cancelled in the panel. */
        const rejected = err instanceof ShippingProviderError && err.status !== undefined && err.status >= 400 && err.status < 500
        if (!rejected) row = await updateShipment(row.id, { bookingAttempt: nextAttempt(row) })
        return await fail('Creating the courier order', err)
      }
    }

    if (!row.awb) {
      let assigned: AssignedAwb
      try {
        assigned = await provider.assignAwb(row.providerShipmentId!, options.courierId)
      } catch (err) {
        if (!saysAlready(err, AWB_ALREADY)) return await fail('Assigning an AWB', err)
        // A retry after a lost reply: the courier already holds an AWB for this shipment.
        const existing = await provider.assignedAwb(row.providerShipmentId!).catch(() => null)
        if (!existing) {
          return await fail(
            'Assigning an AWB',
            new ShippingProviderError(
              `Shiprocket says shipment ${row.providerShipmentId} already has an AWB but did not return it. Read the AWB from the Shiprocket panel.`,
            ),
          )
        }
        assigned = existing
      }
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
    }

    let pickupError: unknown = null
    if (!row.pickupScheduledAt) {
      try {
        row = await markPickup(row.id, (await provider.requestPickup(row.providerShipmentId!)).scheduledAt)
      } catch (err) {
        // "Already in pickup queue" means an earlier, unanswered request worked.
        if (saysAlready(err, PICKUP_ALREADY)) row = await markPickup(row.id, null)
        else pickupError = err
      }
    }

    // Tried even when pickup failed: staff need the label either way. A missing
    // label never blocks the shipment; staff can download it from Shiprocket.
    if (!row.labelUrl) {
      try {
        const labelUrl = await provider.label(row.providerShipmentId!)
        if (labelUrl) row = await updateShipment(row.id, { labelUrl })
      } catch (err) {
        log.warn({ err, orderNumber }, 'shipping label not generated')
      }
    }
    if (pickupError) return await fail('Scheduling the pickup', pickupError)

    return toShipmentView(row)
  } finally {
    await releaseLease(row.id, lease)
  }
}

/** Applies a courier status report (from a webhook or a manual sync). */
export async function applyTracking(
  row: Pick<ShipmentRow, 'id' | 'orderId'>,
  update: TrackingResult,
  log: FastifyBaseLogger,
): Promise<ShipmentRow> {
  const normalised = normaliseCourierStatus(update.providerStatus)
  /* The webhook and the background sync can report on the same parcel at
     once. Each works from the row as it is under a lock, not from a copy its
     caller read earlier, so neither overwrites the other's scans or status. */
  const result = await db.transaction(async (tx) => {
    // Order before shipment: the lock order booking and cancelling use too.
    const [order] = await tx.select({ number: orders.number }).from(orders).where(eq(orders.id, row.orderId)).for('update')
    const [current] = await tx.select().from(shipments).where(eq(shipments.id, row.id)).for('update')
    if (!current) throw ApiError.notFound('That shipment')

    // Merge scans by timestamp + status so repeated reports never duplicate history.
    const seen = new Set(current.events.map((event) => `${event.at}|${event.status}`))
    const merged = [...current.events]
    for (const scan of update.scans) {
      const key = `${scan.at}|${scan.status}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(scan)
      }
    }
    merged.sort((a, b) => a.at.localeCompare(b.at))

    const status = nextShipmentStatus(current.status, normalised)
    const stale = normalised !== null && status !== normalised
    // Shipments booked before the link was saved at booking time still get one.
    const provider = getShippingProvider()
    const fallbackUrl = current.awb && provider?.name === current.provider ? provider.publicTrackingUrl(current.awb) : null
    const [updated] = await tx
      .update(shipments)
      .set({
        status,
        providerStatus: stale ? current.providerStatus : (update.providerStatus ?? current.providerStatus),
        trackingUrl: update.trackingUrl ?? current.trackingUrl ?? fallbackUrl,
        expectedDeliveryAt: update.expectedDeliveryAt ? new Date(update.expectedDeliveryAt) : current.expectedDeliveryAt,
        deliveredAt: status === 'delivered' ? (current.deliveredAt ?? new Date()) : current.deliveredAt,
        events: merged,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, current.id))
      .returning()

    let shipped: OrderRow | undefined
    if (IN_MOTION.includes(status as ShipmentStatus)) {
      // Conditional transitions: never move an order backwards or revive a cancelled one.
      ;[shipped] = await tx
        .update(orders)
        .set({ status: 'shipped', shippedAt: new Date(), trackingNumber: updated.awb, trackingCarrier: updated.courierName })
        .where(and(eq(orders.id, current.orderId), inArray(orders.status, ['paid', 'packed'])))
        .returning()
    }
    let delivered: OrderRow | undefined
    if (status === 'delivered') {
      // Returns a row only for the report that moves the order, so repeats send nothing.
      ;[delivered] = await tx
        .update(orders)
        .set({ status: 'delivered' })
        .where(and(eq(orders.id, current.orderId), inArray(orders.status, ['paid', 'packed', 'shipped'])))
        .returning()
    }
    return { updated, shipped, delivered, previousStatus: current.status, orderNumber: order?.number ?? '' }
  })

  // Emails only once the transaction has committed.
  const { updated, shipped, delivered, orderNumber } = result
  if (shipped && updated.awb) {
    await sendShippedEmail(shipped, updated.courierName, updated.awb, updated.trackingUrl).catch((err) =>
      log.error({ err, orderNumber: shipped.number }, 'shipped email failed'),
    )
  }
  if (delivered) {
    await sendDeliveredEmail(delivered).catch((err) => log.error({ err, orderNumber: delivered.number }, 'delivered email failed'))
  }
  if (updated.status !== result.previousStatus && NEEDS_ATTENTION.includes(updated.status as ShipmentStatus)) {
    const rto = updated.status === 'rto'
    log.warn({ orderNumber, status: updated.status }, 'shipment needs attention')
    await alertStaff({
      subject: rto ? `Order ${orderNumber} is returning to origin` : `Courier problem with order ${orderNumber}`,
      body: [
        rto
          ? 'The courier could not deliver this parcel and is sending it back. Contact the customer, then refund or reship once it arrives.'
          : 'The courier has reported a problem with this parcel. Check it in Shiprocket and contact the customer if needed.',
      ],
      facts: [
        ['Order', orderNumber],
        ['Courier status', updated.providerStatus ?? updated.status],
        ...(updated.awb ? ([['AWB', updated.awb]] as [string, string][]) : []),
      ],
    })
  }
  return updated
}

export async function syncShipment(orderNumber: string, log: FastifyBaseLogger): Promise<ShipmentView> {
  const provider = requireProvider()
  const order = await loadOrder(orderNumber)
  if (!order.shipment?.awb || order.shipment.status === 'cancelled') {
    throw ApiError.conflict('no_shipment', 'This order has no booked shipment to track.')
  }
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

/* ── Cancelling ───────────────────────────────────────────────────────────── */

async function cancelAtProvider(row: ShipmentRow, orderNumber: string, log: FastifyBaseLogger) {
  // Never reached the courier: nothing to cancel there.
  if (!row.providerOrderId) return
  const provider = requireProvider()
  try {
    await provider.cancel(row.providerOrderId)
  } catch (err) {
    log.error({ err, orderNumber }, 'courier cancellation failed')
    throw providerFailure(err)
  }
}

/** Records a cancellation the courier has accepted. The AWB stays for staff; webhooks ignore cancelled rows. */
async function markShipmentCancelled(tx: Tx, shipmentId: string, orderId: string) {
  await tx.update(orders).set({ trackingNumber: null, trackingCarrier: null }).where(eq(orders.id, orderId))
  const [row] = await tx
    .update(shipments)
    .set({ status: 'cancelled', lastError: null, bookingStartedAt: null, updatedAt: new Date() })
    .where(eq(shipments.id, shipmentId))
    .returning()
  return row
}

export async function cancelShipment(orderNumber: string, log: FastifyBaseLogger): Promise<ShipmentView> {
  const order = await loadOrder(orderNumber)
  const row = order.shipment
  if (!row || row.status === 'cancelled') throw ApiError.conflict('no_shipment', 'There is no active shipment to cancel.')
  if (IN_MOTION.includes(row.status as ShipmentStatus)) {
    throw ApiError.conflict('shipment_in_transit', 'The parcel is already with the courier. Cancel it from Shiprocket as a return instead.')
  }
  const lease = await takeLease(row.id)
  try {
    await cancelAtProvider(row, orderNumber, log)
    return toShipmentView(await db.transaction((tx) => markShipmentCancelled(tx, row.id, order.id)))
  } finally {
    await releaseLease(row.id, lease)
  }
}

/** What cancelling the order has to do with its shipment. Throws when the order cannot simply be cancelled. */
function shipmentPlanForOrderCancel(row: ShipmentRow | null | undefined): 'none' | 'cancel' | 'keep' {
  if (!row) return 'none'
  if (leaseHeld(row)) throw bookingInProgress()
  if (row.status === 'cancelled') return 'none'
  if (BEFORE_PICKUP.includes(row.status as ShipmentStatus)) return 'cancel'
  // Already on its way back to us: there is nothing left to cancel at the courier.
  if (row.status === 'rto') return 'keep'
  throw ApiError.conflict(
    'shipment_in_transit',
    `The parcel is already with the courier (${row.status.replaceAll('_', ' ')}), so the order cannot be cancelled. Handle it as a return instead.`,
  )
}

/**
 * Cancels an order's courier shipment, then runs `cancelOrder` inside the
 * transaction that records it, with the order and shipment rows locked.
 *
 * A parcel not yet with the courier is cancelled there first; if that fails
 * the order is left alone (502). A parcel already moving refuses (409). The
 * courier call runs outside the transaction but under the booking lease, so
 * no AWB can be assigned meanwhile.
 */
export async function cancelOrderWithShipment(
  orderId: string,
  orderNumber: string,
  log: FastifyBaseLogger,
  cancelOrder: (tx: Tx) => Promise<boolean>,
): Promise<boolean> {
  const row = await db.query.shipments.findFirst({ where: eq(shipments.orderId, orderId) })
  const plan = shipmentPlanForOrderCancel(row)
  const lease = plan === 'cancel' ? await takeLease(row!.id) : null
  try {
    if (plan === 'cancel') await cancelAtProvider(row!, orderNumber, log)
    return await db.transaction(async (tx) => {
      await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, orderId)).for('update')
      const [fresh] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).for('update')
      if (plan === 'cancel') {
        // Cancelled at the courier, so recorded even if the order turns out to have moved on.
        await markShipmentCancelled(tx, fresh.id, orderId)
      } else if (shipmentPlanForOrderCancel(fresh) !== plan) {
        throw ApiError.conflict('order_changed', 'The shipment changed while you were updating the order. Reload and try again.')
      }
      return cancelOrder(tx)
    })
  } finally {
    if (lease) await releaseLease(row!.id, lease)
  }
}

/** The customer's "on its way" message. Sent once, when the parcel first ships. */
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

/**
 * The customer's "delivered" message. Sent once, on the move to delivered,
 * whether the courier reported it or staff marked it. It says the order was
 * marked delivered rather than that it reached them, and asks them to reply
 * if it did not.
 */
export async function sendDeliveredEmail(order: Pick<OrderRow, 'email' | 'number' | 'shippingName'>) {
  return sendEmail({
    to: order.email,
    subject: `Order ${order.number} has been delivered`,
    heading: 'Delivered',
    body: [
      `${order.shippingName}, your order has been marked as delivered.`,
      'Keep the tea sealed, cool and away from light, and it will stay fresh for months.',
    ],
    facts: [['Order', order.number]],
    action: { label: 'View your order', url: `${env.SITE_URL}/order/${encodeURIComponent(order.number)}` },
    footnote: 'If it has not reached you, reply to this email and we will look into it.',
    // Replies reach a person, not the sending address.
    replyTo: env.CONTACT_INBOX,
  })
}
