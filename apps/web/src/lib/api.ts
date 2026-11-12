import type { Garden, Problem, Product } from '@elegantsip/shared'

/* ────────────────────────────────────────────────────────────────────────────
 * API client.
 *
 * Every call goes through `request()`, so credentials, error shape and network
 * failures are handled once. The API returns RFC 9457 problems whose `detail`
 * is always safe to display, which is what `ApiClientError.message` carries —
 * the UI can surface it verbatim instead of inventing its own wording.
 * ──────────────────────────────────────────────────────────────────────────── */

// Production uses the same origin under /api. Vite proxies this path locally.
const BASE = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    message: string,
    readonly fieldErrors?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }

  /** True when the caller simply is not signed in. */
  get isUnauthenticated(): boolean {
    return this.status === 401
  }
}

const NETWORK_MESSAGE =
  'We could not reach the shop. Check your connection and try again — nothing has been charged.'
const RATE_LIMITED_MESSAGE = 'Too many attempts. Please wait a minute and try again.'

/**
 * A POST that nobody waits for: no answer is read and failures are ignored.
 * `keepalive` lets it finish while the page unloads.
 */
export function beacon(path: string, payload: unknown): void {
  if (typeof fetch !== 'function') return
  try {
    void fetch(`${BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {})
  } catch {
    // Nothing to do: measurement must never break the shop.
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      // Sessions are httpOnly cookies, so every request must carry them.
      credentials: 'include',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ApiClientError(0, 'network_error', NETWORK_MESSAGE)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    // A non-JSON body (a proxy error page, say) is not something the caller
    // can use — fall through to the generic message below.
    body = null
  }

  if (!response.ok) {
    const problem = body as Partial<Problem> | null
    // A limit hit anywhere gets plain words, even when a proxy or the rate
    // limiter answers without our usual problem details.
    const limited = response.status === 429
    throw new ApiClientError(
      response.status,
      problem?.type ?? (limited ? 'rate_limited' : 'unknown_error'),
      problem?.detail ?? (limited ? RATE_LIMITED_MESSAGE : 'Something went wrong. Please try again.'),
      problem?.errors,
      problem?.requestId,
    )
  }

  return body as T
}

const post = <T>(path: string, payload?: unknown) =>
  request<T>(path, { method: 'POST', body: payload === undefined ? undefined : JSON.stringify(payload) })

const put = <T>(path: string, payload: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(payload) })

/* ── Types mirroring the API responses ────────────────────────────────────── */

export interface SessionUser {
  id: string
  email: string
  name: string
  role: 'customer' | 'admin'
  emailVerified: boolean
  /** WhatsApp-only accounts carry stand-in values that must not reach an order. */
  emailIsPlaceholder?: boolean
  nameIsPlaceholder?: boolean
  /** Verified WhatsApp number. */
  phone?: string | null
}

/* ── Two-step sign-in and adding credentials (auth) ─────────────────────── */

export type LoginResult = { user: SessionUser; mfaRequired?: undefined } | { mfaRequired: true; challengeToken: string }

export interface MfaStatus {
  /** A staff account on a server that can store authenticator secrets. */
  available: boolean
  enabled: boolean
  recoveryCodesLeft: number
}

export const mfaApi = {
  status: () => request<MfaStatus>('/v1/auth/mfa'),
  setup: (currentPassword: string) => post<{ secret: string; otpauthUri: string }>('/v1/auth/mfa/setup', { currentPassword }),
  /** Returns the recovery codes, shown once. */
  confirm: (code: string) => post<{ recoveryCodes: string[] }>('/v1/auth/mfa/confirm', { code }),
  disable: (payload: { currentPassword: string; code: string }) => post<{ ok: true }>('/v1/auth/mfa/disable', payload),
}

/** WhatsApp-only accounts adding their first email and password, after a WhatsApp code. */
export const credentialsApi = {
  requestCode: () => post<{ ok: true; challengeId: string }>('/v1/account/credentials/request'),
  add: (payload: { challengeId: string; code: string; email: string; password: string }) =>
    post<{ user: SessionUser; delivered: boolean }>('/v1/account/credentials', payload),
}

/* ── end two-step sign-in ─────────────────────────────────────────────────── */

export interface CartLine {
  productSlug: string
  variantSize: string
  quantity: number
}

export interface PricedLine extends CartLine {
  productName: string
  imageSrc: string
  unitPrice: number
  lineTotal: number
}

export interface CartAdjustment {
  productSlug: string
  variantSize: string
  reason: 'out_of_stock' | 'quantity_reduced' | 'unavailable' | 'price_changed'
  message: string
}

export interface PricingQuote {
  items: PricedLine[]
  subtotal: number
  discount: number
  coupon: { code: string; percentOff: number } | null
  couponError: string | null
  shippingMethod: 'standard' | 'express'
  shippingFee: number
  tax: number
  total: number
  amountToFreeShipping: number
  adjustments: CartAdjustment[]
}

export interface OrderView {
  number: string
  status: 'pending_payment' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
  placedAt: string
  paidAt: string | null
  shippedAt: string | null
  cancelledAt: string | null
  email: string
  items: PricedLine[]
  subtotal: number
  discount: number
  couponCode: string | null
  shippingMethod: string
  shippingFee: number
  tax: number
  total: number
  shipping: {
    name: string
    line1: string
    city: string
    postalCode: string
    state: string | null
    country: string
  }
  billing: {
    name: string
    line1: string
    city: string
    postalCode: string
    state: string | null
    country: string
  }
  tracking: { carrier: string | null; number: string | null } | null
  shipment: {
    status: string
    courierName: string | null
    awb: string | null
    trackingUrl: string | null
    expectedDeliveryAt: string | null
    deliveredAt: string | null
    events: { at: string; status: string; location: string | null }[]
  } | null
  /** Only on the single-order view. */
  refunds?: OrderRefund[]
}

export interface PlaceOrderResult {
  order: OrderView
  payment: {
    provider: string
    gatewayOrderId: string
    amount: number
    currency: string
    publicKey: string
  }
  /** Returned only for a guest and retained in session storage by the storefront. */
  guestAccessToken: string | null
}

export interface ShippingAddress {
  name: string
  line1: string
  city: string
  postalCode: string
  state?: string
  country: 'India'
  phone?: string
}

export interface ReviewView {
  id: string
  author: string
  rating: number
  text: string
  publishedAt: string | null
  verified: boolean
}

export type AddressBookEntry = Omit<ShippingAddress, 'country' | 'phone'> & {
  id: string
  label: string
  country: 'India'
  phone: string | null
  isDefaultShipping: boolean
  isDefaultBilling: boolean
  isDefault: boolean
}

export type AdminOrderStatus = OrderView['status']

export interface AdminOrder {
  number: string
  status: AdminOrderStatus
  placedAt: string
  email: string
  total: number
  itemCount: number
  shippingCity: string
  trackingNumber: string | null
  shipmentStatus: string | null
}

export interface AdminConfig {
  paymentProvider: string
  paymentsLive: boolean
  emailConfigured: boolean
  gstinConfigured: boolean
  sellerState: string
  shippingProvider: 'manual' | 'shiprocket' | 'fake'
  shippingLive: boolean
  metaServerEvents: 'off' | 'test' | 'live'
  metaServerEventsError: string | null
}

export interface AdminShipment {
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
  events: { at: string; status: string; location: string | null; detail: string | null }[]
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

export interface AdminOrderDetail {
  number: string
  status: AdminOrderStatus
  placedAt: string
  email: string
  phone: string | null
  notes: string | null
  items: { productName: string; variantSize: string; quantity: number }[]
  shipping: { name: string; line1: string; city: string; postalCode: string; state: string | null; country: string }
}

export interface AdminReturnRequest {
  id: string
  number: string
  type: 'cancellation' | 'return'
  status: 'requested' | 'approved' | 'rejected' | 'received'
  reason: string
  requestedAt: string
}

export interface LowStockVariant {
  productSlug: string
  productName: string
  size: string
  sku: string
  stock: number
}

export type AdminReviewFilter = 'pending' | 'published' | 'all'

export interface AdminReview {
  id: string
  productSlug: string
  productName: string
  authorName: string
  rating: number
  body: string
  /** Derived from paid orders by the server. */
  verified: boolean
  createdAt: string
  /** Null while the review is hidden from the shop. */
  publishedAt: string | null
}

/* ── Catalogue admin (retire/restore, offers, product fields) ─────────────── */

/** The fields the admin page edits; the API accepts more (see PATCH /v1/admin/products/{slug}). */
export interface AdminProductEdit {
  name?: string
  status?: Product['status']
  description?: string
  longDescription?: string | null
  tastingNotes?: string[]
  harvestLabel?: string | null
  brewingGuide?: NonNullable<Product['brewingGuide']> | null
  category?: string
  bodyLevel?: number | null
  origin?: NonNullable<Product['origin']> | null
  flavorProfile?: NonNullable<Product['flavorProfile']> | null
  /** Main photo, and the gallery after it in display order: site paths from uploadProductPhoto. */
  imageSrc?: string
  images?: string[]
  /** True retires the tea; false brings it back. */
  archived?: boolean
}

/** `end-offer`: price goes up to the regular price. `clear-compare-at`: price stays, struck-out price goes. */
export type OfferAction = 'end-offer' | 'clear-compare-at'

export interface OfferChange {
  productSlug: string
  productName: string
  retired: boolean
  size: string
  before: { price: number; compareAtPrice: number | null }
  after: { price: number; compareAtPrice: number | null }
}

const offerScope = (action: OfferAction, productSlug?: string) =>
  `action=${action}${productSlug ? `&productSlug=${encodeURIComponent(productSlug)}` : ''}`

/* ── end catalogue admin ──────────────────────────────────────────────────── */

export interface InvoiceView {
  number: string
  issuedAt: string
  isTaxInvoice: boolean
  sellerGstin: string | null
  placeOfSupply: string
  hsn: string
  taxRatePercent: number
  lines: { description: string; quantity: number; unitPrice: string; lineTotal: string }[]
  totals: { subtotal: string; discount: string; shipping: string; cgst: string | null; sgst: string | null; igst: string | null; total: string }
  buyer: { name: string; line1: string; city: string; postalCode: string; state: string | null }
}

export type SavedAddress = AddressBookEntry

export interface PincodeLocation {
  officeName: string
  city: string
  district: string
  state: string
  country: 'India'
  deliveryStatus: string | null
}

/* ── Shop settings (storefront status + the admin settings card) ──────────── */

/** What the storefront may offer right now. Read through lib/storeSettings.ts. */
export interface StorefrontStatus {
  paymentsAvailable: boolean
  guestCheckout: boolean
  guarantee: { enabled: boolean; days: number }
}

export interface AdminStoreSettings {
  guestCheckoutEnabled: boolean
  guaranteeEnabled: boolean
  guaranteeDays: number
  lowStockThreshold: number
  updatedAt: string | null
  updatedBy: { name: string; email: string } | null
}

export type AdminStoreSettingsChange = Partial<Omit<AdminStoreSettings, 'updatedAt' | 'updatedBy'>>

/* ── Gardens (admin garden editor) ───────────────────────────────────── */

/** What staff edit on a garden. The image must be a path already in the site's public folder. */
export interface AdminGardenInput {
  name: string
  region: string
  elevation: string
  imageSrc: string
  story: string[]
  productSlugs: string[]
}

export interface AdminGarden extends Omit<AdminGardenInput, 'productSlugs'> {
  id: string
  slug: string
  sortOrder: number
  /** Every linked product, including retired ones the public list hides. */
  products: { slug: string; name: string; archived: boolean }[]
}

/* ── The API surface the storefront uses ──────────────────────────────────── */

export const api = {
  storefront: {
    status: () => request<StorefrontStatus>('/storefront-status'),
  },

  /** The live shop list; retired teas are already left out by the API. */
  catalogue: {
    products: () => request<{ products: Product[] }>('/v1/products'),
  },

  /** Staff only. Shop-wide settings; changes reach the storefront within 30 seconds. */
  storeSettings: {
    get: () => request<AdminStoreSettings>('/v1/admin/settings'),
    update: (change: AdminStoreSettingsChange) =>
      request<AdminStoreSettings>('/v1/admin/settings', { method: 'PATCH', body: JSON.stringify(change) }),
  },

  locations: {
    pincode: (pincode: string) =>
      request<{ pincode: string; locations: PincodeLocation[] }>(`/v1/locations/pincode/${encodeURIComponent(pincode)}`),
  },

  auth: {
    me: () => request<{ user: SessionUser | null }>('/v1/auth/me'),
    /** Which sign-in methods the server can serve right now. */
    methods: () => request<{ whatsapp: boolean }>('/v1/auth/methods'),
    register: (payload: { name: string; email: string; password: string }) =>
      post<{ ok: true }>('/v1/auth/register', payload),
    /** Accounts with two-step sign-in answer with a challenge; finish with `loginWithCode`. */
    login: (payload: { email: string; password: string }) =>
      post<LoginResult>('/v1/auth/login', payload),
    /** A 6-digit authenticator code or a one-time recovery code. */
    loginWithCode: (challengeToken: string, code: string) =>
      post<{ user: SessionUser }>('/v1/auth/login/mfa', { challengeToken, code }),
    logout: () => post<{ ok: true }>('/v1/auth/logout'),
    forgotPassword: (email: string) => post<{ ok: true }>('/v1/auth/password/forgot', { email }),
    resetPassword: (payload: { token: string; password: string }) =>
      post<{ ok: true }>('/v1/auth/password/reset', payload),
    verifyEmail: (token: string) => post<{ ok: true }>('/v1/auth/verify-email', { token }),
    requestWhatsApp: (phone: string) => post<{ ok: true; challengeId?: string }>('/v1/auth/whatsapp/request', { phone }),
    verifyWhatsApp: (challengeId: string, code: string) => post<{ user: SessionUser }>('/v1/auth/whatsapp/verify', { challengeId, code }),
    /** Display name only; email and password have their own routes. */
    updateName: (name: string) =>
      request<{ user: SessionUser }>('/v1/auth/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
    /** Signs out every other device; this one gets a fresh session. `delivered`: the notice email went out. */
    changePassword: (payload: { currentPassword: string; newPassword: string }) =>
      post<{ ok: true; delivered: boolean }>('/v1/auth/password/change', payload),
    /** The new address starts unverified. `delivered`: its confirmation email went out. */
    changeEmail: (payload: { newEmail: string; currentPassword: string }) =>
      post<{ user: SessionUser; delivered: boolean }>('/v1/auth/email/change', payload),
    /** `delivered` is false when nothing went out (mail down, or already confirmed). */
    resendVerification: () => post<{ ok: true; delivered: boolean }>('/v1/auth/verify-email/resend'),
    /** Ends every session, this device included. */
    logoutAll: () => post<{ ok: true }>('/v1/auth/logout-all'),
  },

  pricing: {
    /** The authoritative money. The storefront displays this; it never computes it. */
    quote: (payload: {
      items: CartLine[]
      couponCode?: string
      shippingMethod?: 'standard' | 'express'
    }) => post<PricingQuote>('/v1/pricing/quote', payload),
    validateCoupon: (code: string, subtotal: number) =>
      post<{ valid: boolean; code: string; percentOff: number | null; discount: number; message: string | null }>(
        '/v1/coupons/validate',
        { code, subtotal },
      ),
  },

  orders: {
    place: (payload: {
      items: CartLine[]
      email: string
      shipping: ShippingAddress
      billing: ShippingAddress
      shippingMethod?: 'standard' | 'express'
      couponCode?: string
      notes?: string
      /** True only when the visitor accepted the cookie banner. */
      adConsent?: boolean
    }, requestKeys: { idempotencyKey: string; guestAccessToken?: string } ) =>
      request<PlaceOrderResult>('/v1/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Idempotency-Key': requestKeys.idempotencyKey,
          ...(requestKeys.guestAccessToken ? { 'X-Guest-Access-Token': requestKeys.guestAccessToken } : {}),
        },
      }),
    list: () => request<{ orders: OrderView[] }>('/v1/orders'),
    get: (number: string, guestAccessToken?: string | null) =>
      request<OrderView>(`/v1/orders/${encodeURIComponent(number)}`, {
        ...(guestAccessToken ? { headers: { 'X-Order-Access-Token': guestAccessToken } } : {}),
      }),
    /** The gateway handle for an order still awaiting payment, to reopen Razorpay. */
    payment: (number: string, guestAccessToken?: string | null) =>
      request<PlaceOrderResult['payment']>(`/v1/orders/${encodeURIComponent(number)}/payment`, {
        ...(guestAccessToken ? { headers: { 'X-Order-Access-Token': guestAccessToken } } : {}),
      }),
    /** Sends Razorpay checkout's success response to the server for signature and capture checks. */
    verifyPayment: (
      number: string,
      payload: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
      guestAccessToken?: string | null,
    ) =>
      request<{ status: 'paid' | 'pending' }>(`/v1/orders/${encodeURIComponent(number)}/payment/verify`, {
        method: 'POST',
        body: JSON.stringify(payload),
        ...(guestAccessToken ? { headers: { 'X-Order-Access-Token': guestAccessToken } } : {}),
      }),
    requestReturn: (number: string, payload: { type: 'cancellation' | 'return'; reason: string }) =>
      post<{ id: string; status: 'requested' }>(`/v1/orders/${encodeURIComponent(number)}/return-requests`, payload),
    invoice: (number: string, guestAccessToken?: string | null) => request<{ invoice: InvoiceView }>(`/v1/orders/${encodeURIComponent(number)}/invoice`, {
      ...(guestAccessToken ? { headers: { 'X-Order-Access-Token': guestAccessToken } } : {}),
    }),
  },

  account: {
    addresses: () => request<{ addresses: SavedAddress[] }>('/v1/account/addresses'),
    saveAddress: (payload: Omit<SavedAddress, 'id' | 'phone' | 'isDefault'> & { phone?: string | null }) => post<{ address: SavedAddress }>('/v1/account/addresses', payload),
    updateAddress: (id: string, payload: Omit<SavedAddress, 'id' | 'phone' | 'isDefault'> & { phone?: string | null }) =>
      request<{ address: SavedAddress }>(`/v1/account/addresses/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    deleteAddress: (id: string) => request<{ ok: true }>(`/v1/account/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    requestWhatsApp: (phone: string) => post<{ ok: true; challengeId: string }>('/v1/account/whatsapp/request', { phone }),
    verifyWhatsApp: (challengeId: string, code: string) => post<{ ok: true }>('/v1/account/whatsapp/verify', { challengeId, code }),
  },

  admin: {
    /** Newest first. The API returns at most 200 per call. */
    listOrders: (status?: AdminOrderStatus, limit = 50) =>
      request<{ orders: AdminOrder[] }>(
        `/v1/admin/orders?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`,
      ),
    getOrder: (number: string) => request<AdminOrderDetail>(`/v1/admin/orders/${encodeURIComponent(number)}`),
    updateOrder: (
      number: string,
      payload: {
        status?: Extract<AdminOrderStatus, 'packed' | 'shipped' | 'delivered' | 'cancelled'>
        trackingCarrier?: string
        trackingNumber?: string
      },
    ) =>
      // refundDue: the order was cancelled but its payment is not yet refunded.
      request<{ ok: true; notified: boolean; refundDue?: boolean }>(`/v1/admin/orders/${encodeURIComponent(number)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    config: () => request<AdminConfig>('/v1/admin/config'),
    listReturnRequests: () => request<{ requests: AdminReturnRequest[] }>('/v1/admin/return-requests'),
    updateReturnRequest: (id: string, payload: { status: 'approved' | 'rejected' | 'received'; staffNote?: string }) =>
      request<{ ok: true; restocked: boolean }>(`/v1/admin/return-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    /** Without a threshold the API uses the one in the shop settings. */
    lowStock: (threshold?: number) =>
      request<{ variants: LowStockVariant[] }>(`/v1/admin/stock/low${threshold === undefined ? '' : `?threshold=${threshold}`}`),
    /** Positive delta restocks, negative writes off; either way it is recorded in the stock ledger. */
    adjustStock: (payload: { productSlug: string; variantSize: string; delta: number; note?: string }) =>
      post<{ productSlug: string; variantSize: string; stock: number }>('/v1/admin/stock', payload),
    /** Every product, retired ones included (`archivedAt` set), read live. */
    products: () => request<{ products: Product[] }>('/v1/admin/products'),
    previewOffers: (action: OfferAction, productSlug?: string) =>
      request<{ changes: OfferChange[] }>(`/v1/admin/offers/preview?${offerScope(action, productSlug)}`),
    endOffers: (action: OfferAction, productSlug?: string) =>
      post<{ changes: OfferChange[] }>('/v1/admin/offers', { action, ...(productSlug ? { productSlug } : {}) }),
    updateProduct: (slug: string, payload: AdminProductEdit) =>
      request<{ ok: true }>(`/v1/admin/products/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    /** Sends the file as-is; the API re-encodes it and returns its site path. */
    uploadProductPhoto: (file: File) =>
      request<{ src: string; width: number; height: number }>('/v1/admin/uploads/product-photo', {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': file.type },
      }),
    addVariant: (slug: string, payload: { size: string; price: number; stock: number }) =>
      post<{ slug: string; size: string; price: number; stock: number }>(`/v1/admin/products/${encodeURIComponent(slug)}/variants`, payload),
    /** Only for a pack that has never been ordered; the API refuses otherwise. */
    deleteVariant: (slug: string, size: string) =>
      request<{ ok: true }>(`/v1/admin/products/${encodeURIComponent(slug)}/variants/${encodeURIComponent(size)}`, { method: 'DELETE' }),
    /** Prices are integer paise. A null compareAtPrice ends the offer; omit it to leave it unchanged. */
    updateVariantPrice: (slug: string, size: string, payload: { price: number; compareAtPrice?: number | null }) =>
      request<{ slug: string; size: string; price: number; compareAtPrice: number | null }>(
        `/v1/admin/products/${encodeURIComponent(slug)}/variants/${encodeURIComponent(size)}`,
        { method: 'PATCH', body: JSON.stringify(payload) },
      ),
    listReviews: (status: AdminReviewFilter = 'pending', offset = 0, limit = 50) =>
      request<{ reviews: AdminReview[]; hasMore: boolean }>(`/v1/admin/reviews?status=${status}&limit=${limit}&offset=${offset}`),
    setReviewPublished: (id: string, published: boolean) =>
      request<{ ok: true }>(`/v1/admin/reviews/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ published }) }),
    shipment: (number: string) =>
      request<{ provider: AdminConfig['shippingProvider']; phone: string | null; shipment: AdminShipment | null }>(
        `/v1/admin/orders/${encodeURIComponent(number)}/shipment`,
      ),
    courierRates: (number: string) =>
      request<{ weightGrams: number; recommendedCourierId: number | null; couriers: CourierOption[] }>(
        `/v1/admin/orders/${encodeURIComponent(number)}/shipment/couriers`,
      ),
    bookShipment: (number: string, payload: { courierId?: number; phone?: string }) =>
      post<{ shipment: AdminShipment }>(`/v1/admin/orders/${encodeURIComponent(number)}/shipment`, payload),
    syncShipment: (number: string) =>
      post<{ shipment: AdminShipment }>(`/v1/admin/orders/${encodeURIComponent(number)}/shipment/sync`, {}),
    cancelShipment: (number: string) =>
      post<{ shipment: AdminShipment }>(`/v1/admin/orders/${encodeURIComponent(number)}/shipment/cancel`, {}),
  },

  reviews: {
    /** The newest published reviews across every tea, for the homepage. */
    recent: (limit = 6) =>
      request<{ reviews: (ReviewView & { productSlug: string; productName: string })[] }>(`/v1/reviews/recent?limit=${limit}`),
    list: (slug: string) =>
      request<{ reviews: ReviewView[]; average: number; count: number }>(
        `/v1/products/${encodeURIComponent(slug)}/reviews`,
      ),
    create: (slug: string, payload: { rating: number; text: string }) =>
      post<{ review: ReviewView; pendingModeration: boolean }>(
        `/v1/products/${encodeURIComponent(slug)}/reviews`,
        payload,
      ),
  },

  wishlist: {
    get: () => request<{ productSlugs: string[] }>('/v1/wishlist'),
    replace: (productSlugs: string[]) => put<{ productSlugs: string[] }>('/v1/wishlist', { productSlugs }),
  },

  newsletter: {
    subscribe: (email: string) => post<{ ok: true; welcomeCode: string | null }>('/v1/newsletter', { email }),
  },

  contact: {
    send: (payload: { name: string; email: string; subject: string; message: string }) =>
      post<{ delivered: boolean; retrying: boolean; reference: string }>('/v1/contact', payload),
  },

  /* ── Gardens (public list + admin garden editor) ─────────────────────── */
  gardens: {
    /** Live list; linked teas that are retired are already left out. */
    list: () => request<{ gardens: Garden[] }>('/v1/gardens'),
    adminList: () => request<{ gardens: AdminGarden[] }>('/v1/admin/gardens'),
    create: (payload: AdminGardenInput & { slug: string }) => post<AdminGarden>('/v1/admin/gardens', payload),
    /** `productSlugs` replaces the garden's whole set of links. */
    update: (slug: string, payload: Partial<AdminGardenInput>) =>
      request<AdminGarden>(`/v1/admin/gardens/${encodeURIComponent(slug)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    remove: (slug: string) => request<{ ok: true }>(`/v1/admin/gardens/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  },

  /* ── Admin refunds (order detail on the staff page) ──────────────────── */
  adminRefunds: {
    get: (number: string) => request<AdminRefundLedger>(`/v1/admin/orders/${encodeURIComponent(number)}/refunds`),
    /** `amount` is paise. Repeating the same `idempotencyKey` returns the original refund instead of refunding twice. */
    create: (number: string, payload: { amount: number; reason: string; idempotencyKey: string }) =>
      post<AdminRefundResult>(`/v1/admin/orders/${encodeURIComponent(number)}/refunds`, payload),
  },
}

/* ── Refunds ──────────────────────────────────────────────────────────────── */

/** What a customer sees: `requested` is asked of the gateway and not yet confirmed. Failed attempts are not listed. */
export interface OrderRefund {
  amount: number
  status: 'requested' | 'processed'
  requestedAt: string
  processedAt: string | null
}

export interface AdminRefund {
  id: string
  amount: number
  status: 'pending' | 'processed' | 'failed'
  reason: string
  /** Why it failed, or why a pending refund is unconfirmed. */
  failureReason: string | null
  providerRefundId: string | null
  requestedBy: string | null
  createdAt: string
  processedAt: string | null
}

/** Paise. `refundable` is what a new refund may be for. */
export interface AdminRefundLedger {
  captured: number
  refunded: number
  pending: number
  refundable: number
  orderStatus: string
  /** Fully refunded but never shipped: staff should cancel it if it is not being sent. */
  cancelAdvised: boolean
  refunds: AdminRefund[]
}

export interface AdminRefundResult {
  refund: AdminRefund
  ledger: AdminRefundLedger
  /** True when this key had already been used: no new refund was made. */
  replayed: boolean
  /** True only when the customer email was actually sent; null when none was due from this request. */
  emailed: boolean | null
  advice: string | null
}

/* ── Admin: email outbox and audit log (staff page) ───────────────────────── */

export interface AdminOutboxMessage {
  id: string
  kind: string
  to: string
  subject: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  lastError: string | null
  nextAttemptAt: string
  createdAt: string
  sentAt: string | null
}

export interface AdminAuditActor {
  id: string
  name: string
  email: string
}

export interface AdminAuditEvent {
  id: string
  action: string
  resource: string
  statusCode: number
  occurredAt: string
  actor: AdminAuditActor
}

export const adminOpsApi = {
  emailOutbox: () => request<{ messages: AdminOutboxMessage[] }>('/v1/admin/email-outbox'),
  retryEmail: (id: string) => post<{ message: AdminOutboxMessage }>(`/v1/admin/email-outbox/${encodeURIComponent(id)}/retry`, {}),
  audit: (query: { limit?: number; offset?: number; actor?: string } = {}) => {
    const params = new URLSearchParams({ limit: String(query.limit ?? 50), offset: String(query.offset ?? 0) })
    if (query.actor) params.set('actor', query.actor)
    return request<{ events: AdminAuditEvent[]; hasMore: boolean; actors: AdminAuditActor[] }>(`/v1/admin/audit?${params}`)
  },
}
