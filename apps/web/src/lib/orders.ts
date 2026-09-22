/* ────────────────────────────────────────────────────────────────────────────
 * Order types and helpers for storefront and dashboard integration.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface PlacedOrderItem {
  id: string
  size: string
  name: string
  price: number
  imageSrc: string
  quantity: number
}

export interface PlacedOrder {
  number: string
  date: string
  items: PlacedOrderItem[]
  subtotal: number
  discount: number
  coupon?: string | null
  shippingFee: number
  tax: number
  total: number
  shippingMethod: string
  email: string
  name: string
  address: string
  city: string
  zip: string
  country: string
  notes?: string
}
