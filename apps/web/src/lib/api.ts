import type { Problem } from '@elegantsip/shared'

/* ────────────────────────────────────────────────────────────────────────────
 * API client.
 *
 * Every call goes through `request()`, so credentials, error shape and network
 * failures are handled once. The API returns RFC 9457 problems whose `detail`
 * is always safe to display, which is what `ApiClientError.message` carries —
 * the UI can surface it verbatim instead of inventing its own wording.
 * ──────────────────────────────────────────────────────────────────────────── */

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')

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
    throw new ApiClientError(
      response.status,
      problem?.type ?? 'unknown_error',
      problem?.detail ?? 'Something went wrong. Please try again.',
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
}

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
  tracking: { carrier: string | null; number: string | null } | null
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

/* ── The API surface the storefront uses ──────────────────────────────────── */

export const api = {
  auth: {
    me: () => request<{ user: SessionUser | null }>('/v1/auth/me'),
    register: (payload: { name: string; email: string; password: string }) =>
      post<{ ok: true }>('/v1/auth/register', payload),
    login: (payload: { email: string; password: string }) =>
      post<{ user: SessionUser }>('/v1/auth/login', payload),
    logout: () => post<{ ok: true }>('/v1/auth/logout'),
    forgotPassword: (email: string) => post<{ ok: true }>('/v1/auth/password/forgot', { email }),
    resetPassword: (payload: { token: string; password: string }) =>
      post<{ ok: true }>('/v1/auth/password/reset', payload),
    verifyEmail: (token: string) => post<{ ok: true }>('/v1/auth/verify-email', { token }),
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
      shippingMethod?: 'standard' | 'express'
      couponCode?: string
      notes?: string
    }) => post<PlaceOrderResult>('/v1/orders', payload),
    list: () => request<{ orders: OrderView[] }>('/v1/orders'),
    get: (number: string, email?: string) =>
      request<OrderView>(`/v1/orders/${encodeURIComponent(number)}${email ? `?email=${encodeURIComponent(email)}` : ''}`),
  },

  reviews: {
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
    subscribe: (email: string) => post<{ ok: true; welcomeCode: string }>('/v1/newsletter', { email }),
  },

  contact: {
    send: (payload: { name: string; email: string; subject: string; message: string }) =>
      post<{ delivered: boolean }>('/v1/contact', payload),
  },
}
