/* ────────────────────────────────────────────────────────────────────────────
 * Order records, persisted to this browser's localStorage.
 *
 * Honest scope: until the store has a backend, orders exist only on the device
 * that placed them. Everything that reads these records (the order page, the
 * account history, verified-purchase review badges) says so in its copy.
 * ──────────────────────────────────────────────────────────────────────────── */

import type { CartItem } from '../components/CartContext'
import type { ShippingMethodId } from './pricing'

export interface PlacedOrder {
  number: string
  /** ISO timestamp */
  date: string
  items: CartItem[]
  subtotal: number
  discount: number
  coupon: string | null
  shippingFee: number
  tax: number
  total: number
  shippingMethod: ShippingMethodId
  email: string
  name: string
  address: string
  city: string
  zip: string
  country: string
  notes?: string
}

const ORDERS_KEY = 'elegant_sip_orders'

export function getOrders(): PlacedOrder[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function getOrder(number: string | undefined): PlacedOrder | undefined {
  if (!number) return undefined
  return getOrders().find((o) => o.number === number)
}

export function saveOrder(order: PlacedOrder) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify([order, ...getOrders()]))
}

/** True if any order on this device contains the product  used to gate "Verified purchase" on reviews. */
export function hasPurchased(productId: string): boolean {
  return getOrders().some((o) => o.items.some((i) => i.id === productId))
}
