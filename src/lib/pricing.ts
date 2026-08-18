/* ────────────────────────────────────────────────────────────────────────────
 * Order pricing — single source of truth shared by the cart and checkout so
 * thresholds and rates can never drift between the two.
 * ──────────────────────────────────────────────────────────────────────────── */

/* All amounts in whole Indian Rupees. */
export const FREE_SHIPPING_THRESHOLD = 4000
/** GST rate applied to tea in India. */
export const TAX_RATE = 0.05

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
  { id: 'standard', label: 'Standard', detail: '2–4 business days', fee: 150, freeOver: FREE_SHIPPING_THRESHOLD },
  { id: 'express', label: 'Express', detail: '1–2 business days', fee: 450, freeOver: null },
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
  // Whole-rupee amounts — INR retail carries no paise.
  const estimatedTax = Math.round(subtotalAfterDiscount * TAX_RATE)
  const finalTotal = subtotalAfterDiscount + shippingFee + estimatedTax
  const amountToFreeShipping =
    method.freeOver !== null ? Math.max(0, method.freeOver - subtotalAfterDiscount) : 0
  return { shippingFee, estimatedTax, finalTotal, amountToFreeShipping }
}
