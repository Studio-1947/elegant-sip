import { describe, expect, it } from 'vitest'
import {
  FREE_SHIPPING_THRESHOLD,
  RUPEE,
  SHIPPING_METHODS,
  TAX_RATE,
  calculatePricing,
  couponDiscount,
  formatPaise,
  percentOff,
  rupees,
  toWholeRupees,
} from './money.js'

/*
 * These tests exist because this file is the one place a bug costs real money,
 * and because the storefront and the API both depend on it agreeing with
 * itself. The published figures below are pinned deliberately: they are what
 * the Nov 2026 pricing (GST-inclusive, ₹30 standard shipping, free over
 * ₹1,000) produces, and a refactor must not quietly change anybody's total.
 */

describe('calculatePricing', () => {
  it('charges standard shipping below the free threshold', () => {
    expect(calculatePricing({ subtotal: rupees(500) }).shippingFee).toBe(rupees(30))
  })

  it('makes standard shipping free at exactly the threshold, not a rupee sooner', () => {
    expect(calculatePricing({ subtotal: FREE_SHIPPING_THRESHOLD }).shippingFee).toBe(0)
    expect(calculatePricing({ subtotal: FREE_SHIPPING_THRESHOLD - RUPEE }).shippingFee).toBe(rupees(30))
  })

  it('never makes express free, however large the order', () => {
    expect(calculatePricing({ subtotal: rupees(100_000), shippingMethod: 'express' }).shippingFee).toBe(rupees(450))
  })

  it('applies the discount before testing the free-shipping threshold', () => {
    // ₹1,200 less ₹300 is ₹900 — below the threshold, so shipping applies.
    const p = calculatePricing({ subtotal: rupees(1200), discount: rupees(300) })
    expect(p.shippingFee).toBe(rupees(30))
  })

  it('treats prices as GST-inclusive: tax is the GST contained in the total', () => {
    const p = calculatePricing({ subtotal: rupees(1000) })
    expect(p.total).toBe(rupees(1000))
    expect(p.tax).toBe(toWholeRupees((rupees(1000) * TAX_RATE) / (1 + TAX_RATE)))
    expect(p.tax).toBe(rupees(48))
  })

  it('adds up: total = goods after discount + shipping, with GST inside it', () => {
    const p = calculatePricing({ subtotal: rupees(2500), discount: rupees(250) })
    expect(p.total).toBe(p.taxableGoods + p.shippingFee)
    expect(p.tax).toBeLessThan(p.total)
  })

  it('clamps a discount larger than the cart instead of going negative', () => {
    const p = calculatePricing({ subtotal: rupees(500), discount: rupees(900) })
    expect(p.discount).toBe(rupees(500))
    expect(p.taxableGoods).toBe(0)
    expect(p.total).toBeGreaterThanOrEqual(0)
  })

  it('reports the gap to free shipping, and 0 once reached', () => {
    expect(calculatePricing({ subtotal: rupees(600) }).amountToFreeShipping).toBe(rupees(400))
    expect(calculatePricing({ subtotal: rupees(1500) }).amountToFreeShipping).toBe(0)
  })

  it('reports 0 to free shipping for express, which is never free', () => {
    expect(calculatePricing({ subtotal: rupees(100), shippingMethod: 'express' }).amountToFreeShipping).toBe(0)
  })

  it('falls back to standard for an unknown method', () => {
    const unknown = calculatePricing({ subtotal: rupees(1000), shippingMethod: 'overnight' as never })
    expect(unknown).toEqual(calculatePricing({ subtotal: rupees(1000), shippingMethod: 'standard' }))
  })

  it('keeps SHIPPING_METHODS consistent with the exported threshold', () => {
    expect(SHIPPING_METHODS.find((m) => m.id === 'standard')?.freeOver).toBe(FREE_SHIPPING_THRESHOLD)
  })

  /*
   * The important one. Razorpay is charged `total` in paise; the storefront
   * shows rupees. If any total were not a whole number of rupees the customer
   * would be shown one figure and charged another — the failure mode the
   * shared-money design exists to prevent.
   */
  it('produces whole-rupee totals across the full catalogue price range', () => {
    for (let r = 0; r <= 20_000; r += 7) {
      for (const method of ['standard', 'express'] as const) {
        for (const discountPct of [0, 0.1]) {
          const subtotal = rupees(r)
          const p = calculatePricing({
            subtotal,
            discount: toWholeRupees(subtotal * discountPct),
            shippingMethod: method,
          })
          expect(p.total % RUPEE, `total not whole rupees at ₹${r} / ${method}`).toBe(0)
          expect(p.tax % RUPEE, `tax not whole rupees at ₹${r} / ${method}`).toBe(0)
          expect(Number.isInteger(p.total)).toBe(true)
        }
      }
    }
  })

  it('matches the published figures exactly', () => {
    const published = [
      // One Green Tea (offer price) — below the threshold, so ₹30 shipping.
      { subtotal: 585, discount: 0, method: 'standard', shipping: 30, tax: 29, total: 615 },
      { subtotal: 1000, discount: 0, method: 'standard', shipping: 0, tax: 48, total: 1000 },
      // One Golden Needle by express.
      { subtotal: 3157, discount: 0, method: 'express', shipping: 450, tax: 172, total: 3607 },
      // First Flush + Green Tea — over ₹1,000, so shipping is free.
      { subtotal: 1446, discount: 0, method: 'standard', shipping: 0, tax: 69, total: 1446 },
    ] as const
    for (const c of published) {
      const p = calculatePricing({
        subtotal: rupees(c.subtotal),
        discount: rupees(c.discount),
        shippingMethod: c.method,
      })
      expect(p.shippingFee, `shipping @ ₹${c.subtotal}`).toBe(rupees(c.shipping))
      expect(p.tax, `tax @ ₹${c.subtotal}`).toBe(rupees(c.tax))
      expect(p.total, `total @ ₹${c.subtotal}`).toBe(rupees(c.total))
    }
  })
})

describe('percentOff', () => {
  it('rounds the saving against the struck-out price to a whole percent', () => {
    expect(percentOff(rupees(585), rupees(781))).toBe(25)
    expect(percentOff(rupees(3157), rupees(4209))).toBe(25)
  })

  it('shows nothing when there is no offer or no saving', () => {
    expect(percentOff(rupees(585), null)).toBeNull()
    expect(percentOff(rupees(585), rupees(585))).toBeNull()
    expect(percentOff(rupees(600), rupees(585))).toBeNull()
  })
})

describe('couponDiscount', () => {
  it('takes 10% off, rounded to a whole rupee', () => {
    expect(couponDiscount({ code: 'SIP10', percentOff: 0.1 }, rupees(1555))).toBe(rupees(156))
  })

  it('declines below the minimum subtotal', () => {
    const rule = { code: 'BIG', percentOff: 0.2, minSubtotal: rupees(2000) }
    expect(couponDiscount(rule, rupees(1999))).toBe(0)
    expect(couponDiscount(rule, rupees(2000))).toBe(rupees(400))
  })
})

describe('formatPaise', () => {
  it('uses Indian digit grouping (lakh), not thousands', () => {
    expect(formatPaise(rupees(125_000))).toBe('₹1,25,000')
    expect(formatPaise(rupees(2350))).toBe('₹2,350')
  })

  it('never renders paise', () => {
    expect(formatPaise(rupees(999) + 60)).not.toContain('.')
  })

  it('renders a non-finite amount as zero rather than "₹NaN"', () => {
    expect(formatPaise(Number.NaN)).toBe('₹0')
    expect(formatPaise(Number.POSITIVE_INFINITY)).toBe('₹0')
  })
})
