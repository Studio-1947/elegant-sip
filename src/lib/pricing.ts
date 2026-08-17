/* ────────────────────────────────────────────────────────────────────────────
 * Order pricing — single source of truth shared by the cart and checkout so
 * thresholds and rates can never drift between the two.
 * ──────────────────────────────────────────────────────────────────────────── */

export const FREE_SHIPPING_THRESHOLD = 50
export const TAX_RATE = 0.08

export type ShippingMethodId = 'standard' | 'express'

export interface ShippingMethod {
  id: ShippingMethodId
  label: string
  detail: string
  fee: number
  /** Order value (after discount) at which this method becomes free; null = never free. */
  freeOver: number | null
}

export const SHIPPING_METHODS: ShippingMethod[] = [
  { id: 'standard', label: 'Standard', detail: '2–4 business days', fee: 5, freeOver: FREE_SHIPPING_THRESHOLD },
  { id: 'express', label: 'Express', detail: '1–2 business days', fee: 15, freeOver: null },
]

export interface OrderPricing {
  shippingFee: number
  estimatedTax: number
  finalTotal: number
  /** How much more the customer must spend for free standard shipping (0 if reached or not offered). */
  amountToFreeShipping: number
}

export function getOrderPricing(
  cartTotal: number,
  discount: number,
  methodId: ShippingMethodId = 'standard',
): OrderPricing {
  const method = SHIPPING_METHODS.find((m) => m.id === methodId) ?? SHIPPING_METHODS[0]
  const subtotalAfterDiscount = Math.max(0, cartTotal - discount)
  const shippingFee =
    method.freeOver !== null && subtotalAfterDiscount >= method.freeOver ? 0 : method.fee
  const estimatedTax = Math.round(subtotalAfterDiscount * TAX_RATE * 100) / 100
  const finalTotal = Math.round((subtotalAfterDiscount + shippingFee + estimatedTax) * 100) / 100
  const amountToFreeShipping =
    method.freeOver !== null ? Math.max(0, method.freeOver - subtotalAfterDiscount) : 0
  return { shippingFee, estimatedTax, finalTotal, amountToFreeShipping }
}
