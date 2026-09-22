/* ────────────────────────────────────────────────────────────────────────────
 * Pricing — display only.
 *
 * This module used to be the authority on what a customer paid. It is not any
 * more: the server prices every cart at /v1/pricing/quote and again when the
 * order is placed, and the storefront shows what it is told.
 *
 * These re-exports exist so the UI can render an optimistic figure before the
 * quote returns, and so shipping labels and thresholds have one definition.
 * They come from @elegantsip/shared — the same code the server runs — so an
 * optimistic figure and the authoritative one agree.
 * ──────────────────────────────────────────────────────────────────────────── */

export {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_METHODS,
  TAX_RATE,
  calculatePricing,
  getShippingMethod,
  toWholeRupees,
  type Pricing,
  type ShippingMethod,
  type ShippingMethodId,
} from '@elegantsip/shared'

import { calculatePricing, type ShippingMethodId } from '@elegantsip/shared'

export interface OrderPricing {
  shippingFee: number
  estimatedTax: number
  finalTotal: number
  amountToFreeShipping: number
}

/**
 * Legacy shape, kept so the cart and drawer render without a round-trip.
 *
 * @deprecated Prefer the server quote. This is an estimate for immediate
 * feedback; the checkout total always comes from the API.
 */
export function getOrderPricing(
  cartTotal: number,
  discount: number,
  methodId: ShippingMethodId = 'standard',
): OrderPricing {
  const isRupees = cartTotal < 10000
  const subtotal = isRupees ? cartTotal * 100 : cartTotal
  const disc = isRupees ? discount * 100 : discount
  const p = calculatePricing({ subtotal, discount: disc, shippingMethod: methodId })
  if (isRupees) {
    return {
      shippingFee: Math.round(p.shippingFee / 100),
      estimatedTax: Math.round(p.tax / 100),
      finalTotal: Math.round(p.total / 100),
      amountToFreeShipping: Math.round(p.amountToFreeShipping / 100),
    }
  }
  return {
    shippingFee: p.shippingFee,
    estimatedTax: p.tax,
    finalTotal: p.total,
    amountToFreeShipping: p.amountToFreeShipping,
  }
}
