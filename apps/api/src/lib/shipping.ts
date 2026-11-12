import { randomInt } from 'node:crypto'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Courier provider.
 *
 * The same seam as the payment gateway: Shiprocket is the real implementation,
 * `fake` behaves like it (AWB, pickup, label, scans) without an account, so the
 * whole fulfilment path runs locally and in tests.
 *
 * Every method maps Shiprocket's loosely-typed responses into small, strict
 * shapes. Nothing outside this file knows Shiprocket's field names.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface ShipmentAddress {
  name: string
  line1: string
  city: string
  postalCode: string
  state: string
  country: string
  phone: string
  email: string
}

export interface ShipmentInput {
  /** Sent as Shiprocket's order_id: the order number, suffixed on rebookings (see providerOrderRef). */
  orderNumber: string
  orderDate: Date
  billing: ShipmentAddress
  shipping: ShipmentAddress
  items: { name: string; sku: string; units: number; unitPrice: number }[]
  /** All money in paise. */
  subtotal: number
  discount: number
  shippingFee: number
  weightGrams: number
}

export interface CourierOption {
  courierId: number
  courierName: string
  /** Paise. */
  rate: number
  estimatedDays: number | null
  etd: string | null
  rating: number | null
}

export interface TrackingScan {
  at: string
  status: string
  location: string | null
  detail: string | null
}

export interface TrackingResult {
  providerStatus: string | null
  trackingUrl: string | null
  expectedDeliveryAt: string | null
  scans: TrackingScan[]
}

export class ShippingProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'ShippingProviderError'
  }
}

export interface AssignedAwb {
  awb: string
  courierId: number | null
  courierName: string | null
}

export interface ShippingProvider {
  readonly name: string
  createOrder(input: ShipmentInput): Promise<{ providerOrderId: string; providerShipmentId: string }>
  courierOptions(input: { deliveryPostcode: string; weightGrams: number; declaredValue: number }): Promise<{
    couriers: CourierOption[]
    recommendedCourierId: number | null
  }>
  assignAwb(providerShipmentId: string, courierId?: number): Promise<AssignedAwb>
  /** The AWB the courier already holds for a shipment, for when the reply to assignAwb was lost. */
  assignedAwb(providerShipmentId: string): Promise<AssignedAwb | null>
  requestPickup(providerShipmentId: string): Promise<{ scheduledAt: string | null }>
  label(providerShipmentId: string): Promise<string | null>
  track(awb: string): Promise<TrackingResult>
  cancel(providerOrderId: string): Promise<void>
  /** Public tracking page for an AWB, known as soon as it is assigned. */
  publicTrackingUrl(awb: string): string | null
}

const toRupees = (paise: number) => Math.round(paise) / 100

/** "2026-11-05 14:32:10" (Shiprocket, IST) → ISO. Falls back to Date parsing. */
export function parseProviderDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const local = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/)
  const date = local ? new Date(`${local[1]}T${local[2]}+05:30`) : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/* ── Shiprocket ───────────────────────────────────────────────────────────── */

class ShiprocketProvider implements ShippingProvider {
  readonly name = 'shiprocket'
  private token: { value: string; expiresAt: number } | null = null

  constructor(
    private readonly baseUrl: string,
    private readonly email: string,
    private readonly password: string,
    private readonly pickupLocation: string,
    private readonly pickupPostcode: string,
  ) {}

  /** Tokens last 10 days; refresh a day early, and on any 401. */
  private async authToken(force = false): Promise<string> {
    if (!force && this.token && this.token.expiresAt > Date.now()) return this.token.value
    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => ({}))) as { token?: string; message?: string }
    if (!response.ok || !body.token) {
      throw new ShippingProviderError(`Shiprocket login failed: ${body.message ?? response.status}`, response.status)
    }
    this.token = { value: body.token, expiresAt: Date.now() + 9 * 24 * 60 * 60 * 1000 }
    return body.token
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown, retried = false): Promise<T> {
    const token = await this.authToken()
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })
    if (response.status === 401 && !retried) {
      await this.authToken(true)
      return this.call<T>(method, path, body, true)
    }
    const text = await response.text()
    let parsed: unknown
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    if (!response.ok) {
      const message = (parsed as { message?: string } | null)?.message ?? text.slice(0, 200)
      throw new ShippingProviderError(`Shiprocket ${path} failed (${response.status}): ${message}`, response.status)
    }
    return parsed as T
  }

  async createOrder(input: ShipmentInput) {
    const split = (name: string) => {
      const [first, ...rest] = name.trim().split(/\s+/)
      return { first: first ?? name, last: rest.join(' ') }
    }
    const billingName = split(input.billing.name)
    const shippingName = split(input.shipping.name)
    const sameAddress =
      input.billing.line1 === input.shipping.line1 &&
      input.billing.postalCode === input.shipping.postalCode &&
      input.billing.name === input.shipping.name
    const pad = (n: number) => String(n).padStart(2, '0')
    // Shiprocket expects IST wall-clock time.
    const ist = new Date(input.orderDate.getTime() + 330 * 60_000)
    const orderDate = `${ist.getUTCFullYear()}-${pad(ist.getUTCMonth() + 1)}-${pad(ist.getUTCDate())} ${pad(ist.getUTCHours())}:${pad(ist.getUTCMinutes())}`

    const body = await this.call<{ order_id?: number; shipment_id?: number; message?: string }>('POST', '/orders/create/adhoc', {
      order_id: input.orderNumber,
      order_date: orderDate,
      pickup_location: this.pickupLocation,
      billing_customer_name: billingName.first,
      billing_last_name: billingName.last,
      billing_address: input.billing.line1,
      billing_city: input.billing.city,
      billing_pincode: input.billing.postalCode,
      billing_state: input.billing.state,
      billing_country: input.billing.country,
      billing_email: input.billing.email,
      billing_phone: input.billing.phone,
      shipping_is_billing: sameAddress,
      ...(sameAddress
        ? {}
        : {
            shipping_customer_name: shippingName.first,
            shipping_last_name: shippingName.last,
            shipping_address: input.shipping.line1,
            shipping_city: input.shipping.city,
            shipping_pincode: input.shipping.postalCode,
            shipping_state: input.shipping.state,
            shipping_country: input.shipping.country,
            shipping_email: input.shipping.email,
            shipping_phone: input.shipping.phone,
          }),
      order_items: input.items.map((item) => ({
        name: item.name,
        sku: item.sku,
        units: item.units,
        selling_price: toRupees(item.unitPrice),
        hsn: '0902',
      })),
      payment_method: 'Prepaid',
      shipping_charges: toRupees(input.shippingFee),
      total_discount: toRupees(input.discount),
      sub_total: toRupees(input.subtotal),
      length: env.SHIP_PACKAGE_LENGTH_CM,
      breadth: env.SHIP_PACKAGE_BREADTH_CM,
      height: env.SHIP_PACKAGE_HEIGHT_CM,
      weight: Math.max(0.1, input.weightGrams / 1000),
    })
    if (!body?.order_id || !body.shipment_id) {
      throw new ShippingProviderError(`Shiprocket did not create the order: ${body?.message ?? 'no shipment id returned'}`)
    }
    return { providerOrderId: String(body.order_id), providerShipmentId: String(body.shipment_id) }
  }

  async courierOptions(input: { deliveryPostcode: string; weightGrams: number; declaredValue: number }) {
    const query = new URLSearchParams({
      pickup_postcode: this.pickupPostcode,
      delivery_postcode: input.deliveryPostcode,
      weight: String(Math.max(0.1, input.weightGrams / 1000)),
      cod: '0',
      declared_value: String(toRupees(input.declaredValue)),
    })
    const body = await this.call<{
      data?: {
        recommended_courier_company_id?: number
        available_courier_companies?: Array<{
          courier_company_id: number
          courier_name: string
          rate: number | string
          estimated_delivery_days?: number | string
          etd?: string
          rating?: number
        }>
      }
    }>('GET', `/courier/serviceability/?${query.toString()}`)
    const couriers = (body?.data?.available_courier_companies ?? []).map((c) => ({
      courierId: c.courier_company_id,
      courierName: c.courier_name,
      rate: Math.round(Number(c.rate) * 100),
      estimatedDays: c.estimated_delivery_days !== undefined && c.estimated_delivery_days !== '' ? Number(c.estimated_delivery_days) : null,
      etd: c.etd ?? null,
      rating: typeof c.rating === 'number' ? c.rating : null,
    }))
    couriers.sort((a, b) => a.rate - b.rate)
    return { couriers, recommendedCourierId: body?.data?.recommended_courier_company_id ?? null }
  }

  async assignAwb(providerShipmentId: string, courierId?: number) {
    const body = await this.call<{
      awb_assign_status?: number
      message?: string
      response?: { data?: { awb_code?: string; courier_company_id?: number; courier_name?: string; awb_assign_error?: string } }
    }>('POST', '/courier/assign/awb', {
      shipment_id: Number(providerShipmentId),
      ...(courierId ? { courier_id: courierId } : {}),
    })
    const data = body?.response?.data
    if (body?.awb_assign_status !== 1 || !data?.awb_code) {
      throw new ShippingProviderError(`AWB not assigned: ${data?.awb_assign_error ?? body?.message ?? 'courier rejected the shipment'}`)
    }
    return { awb: data.awb_code, courierId: data.courier_company_id ?? courierId ?? null, courierName: data.courier_name ?? null }
  }

  /*
   * Unverified against a live account: assumes GET /shipments/{id} answers
   * { data: { awb, courier_id?, courier_name? } }. Fields are read defensively,
   * and a miss returns null so staff are told to read the AWB from the panel.
   */
  async assignedAwb(providerShipmentId: string) {
    const body = await this.call<{
      data?: { awb?: string | number; awb_code?: string; courier_id?: number | string; courier_company_id?: number; courier_name?: string; courier?: string }
    }>('GET', `/shipments/${encodeURIComponent(providerShipmentId)}`)
    const data = body?.data
    const awb = data?.awb || data?.awb_code
    if (!awb) return null
    const courierId = Number(data?.courier_company_id ?? data?.courier_id)
    return { awb: String(awb), courierId: Number.isFinite(courierId) && courierId > 0 ? courierId : null, courierName: data?.courier_name ?? data?.courier ?? null }
  }

  async requestPickup(providerShipmentId: string) {
    const body = await this.call<{ pickup_status?: number; response?: { pickup_scheduled_date?: string }; message?: string }>(
      'POST',
      '/courier/generate/pickup',
      { shipment_id: [Number(providerShipmentId)] },
    )
    if (body?.pickup_status !== 1) throw new ShippingProviderError(`Pickup not scheduled: ${body?.message ?? 'unknown reason'}`)
    return { scheduledAt: parseProviderDate(body.response?.pickup_scheduled_date) }
  }

  async label(providerShipmentId: string) {
    const body = await this.call<{ label_created?: number; label_url?: string }>('POST', '/courier/generate/label', {
      shipment_id: [Number(providerShipmentId)],
    })
    return body?.label_created === 1 && body.label_url ? body.label_url : null
  }

  async track(awb: string): Promise<TrackingResult> {
    const body = await this.call<{
      tracking_data?: {
        track_url?: string
        etd?: string
        shipment_track?: Array<{ current_status?: string; edd?: string }>
        shipment_track_activities?: Array<{ date?: string; activity?: string; location?: string; 'sr-status-label'?: string }>
      }
    }>('GET', `/courier/track/awb/${encodeURIComponent(awb)}`)
    const data = body?.tracking_data
    const scans = (data?.shipment_track_activities ?? [])
      .map((scan) => ({
        at: parseProviderDate(scan.date) ?? '',
        status: scan['sr-status-label'] || scan.activity || 'Update',
        location: scan.location || null,
        detail: scan.activity || null,
      }))
      .filter((scan) => scan.at)
      .sort((a, b) => a.at.localeCompare(b.at))
    return {
      providerStatus: data?.shipment_track?.[0]?.current_status ?? null,
      trackingUrl: data?.track_url ?? null,
      expectedDeliveryAt: parseProviderDate(data?.shipment_track?.[0]?.edd ?? data?.etd),
      scans,
    }
  }

  async cancel(providerOrderId: string) {
    await this.call('POST', '/orders/cancel', { ids: [Number(providerOrderId)] })
  }

  /** The same page Shiprocket returns as `track_url`; webhooks never include it. */
  publicTrackingUrl(awb: string) {
    return `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`
  }
}

/* ── Fake ─────────────────────────────────────────────────────────────────── */

type FakeStep = 'createOrder' | 'assignAwb' | 'requestPickup' | 'label' | 'cancel'

/** Local stand-in. Shared state is static so tests and the app agree. */
export class FakeShippingProvider implements ShippingProvider {
  readonly name = 'fake'
  private static readonly tracking = new Map<string, TrackingResult>()
  private static readonly awbs = new Map<string, AssignedAwb>()
  private static readonly pickups = new Set<string>()
  private static readonly failures = new Map<FakeStep, { message: string; applied: boolean }>()
  private static readonly delays = new Map<FakeStep, number>()
  /** Test record of every call: the step and its key argument (order_id, shipment id or provider order id). */
  static readonly calls: { step: FakeStep; arg: string; weightGrams?: number }[] = []

  /** Runs one step, honouring the test hooks below. */
  private async step<T>(step: FakeStep, arg: string, run: () => T, weightGrams?: number): Promise<T> {
    FakeShippingProvider.calls.push({ step, arg, ...(weightGrams !== undefined ? { weightGrams } : {}) })
    const delay = FakeShippingProvider.delays.get(step)
    if (delay) {
      FakeShippingProvider.delays.delete(step)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    const failure = FakeShippingProvider.failures.get(step)
    if (failure) {
      FakeShippingProvider.failures.delete(step)
      // `applied`: the courier did the work but the reply never arrived.
      if (failure.applied) run()
      throw new ShippingProviderError(failure.message)
    }
    return run()
  }

  async createOrder(input: ShipmentInput) {
    return this.step(
      'createOrder',
      input.orderNumber,
      () => ({ providerOrderId: String(randomInt(10_000_000, 99_999_999)), providerShipmentId: String(randomInt(10_000_000, 99_999_999)) }),
      input.weightGrams,
    )
  }

  async courierOptions(input: { deliveryPostcode: string; weightGrams: number }) {
    const slabs = Math.max(1, Math.ceil(input.weightGrams / 500))
    return {
      couriers: [
        { courierId: 1, courierName: 'Fake Surface', rate: 4500 * slabs, estimatedDays: 5, etd: null, rating: 3.9 },
        { courierId: 2, courierName: 'Fake Air', rate: 7500 * slabs, estimatedDays: 2, etd: null, rating: 4.4 },
      ],
      recommendedCourierId: 1,
    }
  }

  async assignAwb(providerShipmentId: string, courierId?: number) {
    // Like Shiprocket, a second assignment is refused rather than repeated.
    if (FakeShippingProvider.awbs.has(providerShipmentId)) {
      throw new ShippingProviderError('AWB not assigned: AWB is already assigned to this shipment')
    }
    return this.step('assignAwb', providerShipmentId, () => {
      const assigned = { awb: `FAKE${randomInt(100_000_000, 999_999_999)}`, courierId: courierId ?? 1, courierName: courierId === 2 ? 'Fake Air' : 'Fake Surface' }
      FakeShippingProvider.awbs.set(providerShipmentId, assigned)
      FakeShippingProvider.tracking.set(assigned.awb, { providerStatus: 'AWB ASSIGNED', trackingUrl: null, expectedDeliveryAt: null, scans: [] })
      return assigned
    })
  }

  async assignedAwb(providerShipmentId: string) {
    return FakeShippingProvider.awbs.get(providerShipmentId) ?? null
  }

  async requestPickup(providerShipmentId: string) {
    if (FakeShippingProvider.pickups.has(providerShipmentId)) throw new ShippingProviderError('Pickup not scheduled: Already in Pickup Queue.')
    return this.step('requestPickup', providerShipmentId, () => {
      FakeShippingProvider.pickups.add(providerShipmentId)
      return { scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
    })
  }

  async label(providerShipmentId: string) {
    return this.step('label', providerShipmentId, () => `https://example.invalid/labels/${providerShipmentId}.pdf`)
  }

  async track(awb: string): Promise<TrackingResult> {
    return FakeShippingProvider.tracking.get(awb) ?? { providerStatus: null, trackingUrl: null, expectedDeliveryAt: null, scans: [] }
  }

  async cancel(providerOrderId: string) {
    await this.step('cancel', providerOrderId, () => undefined)
  }

  publicTrackingUrl(awb: string) {
    return `https://track.example/${encodeURIComponent(awb)}`
  }

  /** Test helper: what the courier would report next. */
  static setTracking(awb: string, result: TrackingResult) {
    FakeShippingProvider.tracking.set(awb, result)
  }

  /** Test helper: the next call to `step` fails; with `applied`, after the courier has done it. */
  static failNext(step: FakeStep, message = `fake ${step} failed`, options: { applied?: boolean } = {}) {
    FakeShippingProvider.failures.set(step, { message, applied: options.applied ?? false })
  }

  /** Test helper: the next call to `step` takes this long, to overlap concurrent requests. */
  static delayNext(step: FakeStep, ms: number) {
    FakeShippingProvider.delays.set(step, ms)
  }
}

let cached: ShippingProvider | null = null

/** Null when shipping is manual — callers must handle that, not assume a courier. */
export function getShippingProvider(): ShippingProvider | null {
  if (cached) return cached
  if (env.SHIPPING_PROVIDER === 'manual') return null
  cached =
    env.SHIPPING_PROVIDER === 'shiprocket'
      ? new ShiprocketProvider(
          env.SHIPROCKET_API_BASE_URL,
          env.SHIPROCKET_EMAIL!,
          env.SHIPROCKET_PASSWORD!,
          env.SHIPROCKET_PICKUP_LOCATION!,
          env.SHIPROCKET_PICKUP_POSTCODE!,
        )
      : new FakeShippingProvider()
  return cached
}

/** Test seam. */
export const __setShippingProvider = (provider: ShippingProvider | null) => {
  cached = provider
}
