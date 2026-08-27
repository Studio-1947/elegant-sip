/* ────────────────────────────────────────────────────────────────────────────
 * Money — the single implementation of every rule that decides what a customer
 * is charged. Imported by BOTH the storefront and the API.
 *
 * Why this file is shared rather than duplicated: the storefront displays a
 * total and the server charges one. If the two implement the same rules
 * separately they will eventually disagree by a rupee, and the customer will
 * see one number and be charged another. There is exactly one rounding rule
 * here and both sides call it.
 *
 * ── Units ───────────────────────────────────────────────────────────────────
 * Amounts are stored and transmitted as INTEGER PAISE (1 rupee = 100 paise),
 * because Razorpay settles in paise and floats cannot represent money.
 *
 * But Elegant Sip prices in WHOLE RUPEES and always has — no product costs
 * ₹599.50, and the storefront has never displayed paise. So GST is rounded to
 * a whole rupee, exactly as the original client-side `getOrderPricing()` did
 * with `Math.round()`. Keeping that rule means the migration to a real backend
 * does not silently change anybody's total.
 * ──────────────────────────────────────────────────────────────────────────── */

/** 1 rupee, in paise. */
export const RUPEE = 100

/** GST rate on tea in India. */
export const TAX_RATE = 0.05

/** Order value (after discount) at which standard shipping becomes free. */
export const FREE_SHIPPING_THRESHOLD = 4000 * RUPEE

export type ShippingMethodId = 'standard' | 'express'

export interface ShippingMethod {
  id: ShippingMethodId
  label: string
  detail: string
  /** Fee in paise. */
  fee: number
  /** Value after discount at which this method is free; null = never free. */
  freeOver: number | null
}

export const SHIPPING_METHODS: readonly ShippingMethod[] = [
  {
    id: 'standard',
    label: 'Standard',
    detail: '2–4 business days',
    fee: 150 * RUPEE,
    freeOver: FREE_SHIPPING_THRESHOLD,
  },
  {
    id: 'express',
    label: 'Express',
    detail: '1–2 business days',
    fee: 450 * RUPEE,
    freeOver: null,
  },
]

export const getShippingMethod = (id: ShippingMethodId): ShippingMethod =>
  SHIPPING_METHODS.find((m) => m.id === id) ?? SHIPPING_METHODS[0]

/**
 * Round a paise amount to a whole rupee.
 *
 * THE rounding rule. Every tax and total figure passes through here, on both
 * the client and the server, so the two can never drift apart.
 */
export const toWholeRupees = (paise: number): number => Math.round(paise / RUPEE) * RUPEE

export interface PricingInput {
  /** Sum of line totals, in paise, before any discount. */
  subtotal: number
  /** Coupon discount in paise. Clamped to the subtotal. */
  discount?: number
  shippingMethod?: ShippingMethodId
}

export interface Pricing {
  /** Before discount. */
  subtotal: number
  /** Actually applied — never more than the subtotal. */
  discount: number
  /** Subtotal less discount. */
  taxableGoods: number
  shippingFee: number
  /** GST on goods AND shipping, rounded to a whole rupee. */
  tax: number
  total: number
  /** How much more to spend for free standard shipping; 0 once reached. */
  amountToFreeShipping: number
}

/**
 * The authoritative price calculation.
 *
 * GST applies to the shipping fee as well as the goods — the summary line is
 * labelled "GST (5%)", so taxing only the goods would understate the total.
 */
export function calculatePricing({
  subtotal,
  discount = 0,
  shippingMethod = 'standard',
}: PricingInput): Pricing {
  const method = getShippingMethod(shippingMethod)

  const appliedDiscount = Math.min(Math.max(0, Math.round(discount)), Math.max(0, subtotal))
  const taxableGoods = Math.max(0, subtotal - appliedDiscount)

  const shippingFee =
    method.freeOver !== null && taxableGoods >= method.freeOver ? 0 : method.fee

  const tax = toWholeRupees((taxableGoods + shippingFee) * TAX_RATE)
  const total = taxableGoods + shippingFee + tax

  const amountToFreeShipping =
    method.freeOver !== null ? Math.max(0, method.freeOver - taxableGoods) : 0

  return { subtotal, discount: appliedDiscount, taxableGoods, shippingFee, tax, total, amountToFreeShipping }
}

/* ── Coupons ──────────────────────────────────────────────────────────────── */

export interface CouponRule {
  code: string
  /** Fraction off, e.g. 0.1 for 10%. */
  percentOff: number
  /** Minimum subtotal in paise before the code applies. */
  minSubtotal?: number
}

/**
 * Seed coupons, matching what the storefront has always offered. The API keeps
 * these in the database — this list is the migration seed and the offline
 * fallback, not the runtime source of truth.
 */
export const SEED_COUPONS: readonly CouponRule[] = [
  { code: 'SIP10', percentOff: 0.1 },
  { code: 'WELCOME10', percentOff: 0.1 },
]

/** Discount for a coupon against a subtotal, in whole rupees. */
export function couponDiscount(rule: CouponRule, subtotal: number): number {
  if (rule.minSubtotal && subtotal < rule.minSubtotal) return 0
  return toWholeRupees(subtotal * rule.percentOff)
}

/* ── Presentation ─────────────────────────────────────────────────────────── */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

/**
 * Format paise as Indian-grouped rupees: 125000_00 → "₹1,25,000".
 *
 * A non-finite amount renders as zero: it is a bug either way, but showing a
 * customer "₹NaN" is the worse of the two.
 */
export const formatPaise = (paise: number): string =>
  inr.format(Number.isFinite(paise) ? Math.round(paise) / RUPEE : 0)

/** Convenience for literals in seed data and tests. */
export const rupees = (n: number): number => Math.round(n * RUPEE)
