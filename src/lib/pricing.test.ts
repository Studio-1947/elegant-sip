import { describe, expect, it } from 'vitest'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS, TAX_RATE, getOrderPricing } from './pricing'

/*
 * Money math is the one place a silent bug costs real money, and it is shared
 * by the cart, the drawer and all three checkout steps. These tests pin the
 * behaviour that the components rely on.
 */

describe('getOrderPricing', () => {
  it('charges the standard fee below the free-shipping threshold', () => {
    const { shippingFee } = getOrderPricing(1000, 0, 'standard')
    expect(shippingFee).toBe(150)
  })

  it('makes standard shipping free at exactly the threshold', () => {
    expect(getOrderPricing(FREE_SHIPPING_THRESHOLD, 0, 'standard').shippingFee).toBe(0)
    expect(getOrderPricing(FREE_SHIPPING_THRESHOLD - 1, 0, 'standard').shippingFee).toBe(150)
  })

  it('never makes express free, however large the order', () => {
    expect(getOrderPricing(100_000, 0, 'express').shippingFee).toBe(450)
  })

  it('applies the discount before testing the free-shipping threshold', () => {
    // ₹4,200 less a ₹500 coupon is ₹3,700 — below the threshold, so shipping applies.
    expect(getOrderPricing(4200, 500, 'standard').shippingFee).toBe(150)
  })

  it('taxes goods and shipping together, matching the "GST (5%)" label', () => {
    const { estimatedTax } = getOrderPricing(1000, 0, 'standard')
    expect(estimatedTax).toBe(Math.round((1000 + 150) * TAX_RATE))
    expect(estimatedTax).toBe(58)
  })

  it('returns whole rupees only — INR retail carries no paise', () => {
    for (const total of [333, 777, 1234, 4001, 99_999]) {
      const p = getOrderPricing(total, 0, 'standard')
      expect(Number.isInteger(p.estimatedTax)).toBe(true)
      expect(Number.isInteger(p.finalTotal)).toBe(true)
      expect(Number.isInteger(p.shippingFee)).toBe(true)
    }
  })

  it('adds up: total = discounted subtotal + shipping + tax', () => {
    const cartTotal = 2500
    const discount = 250
    const p = getOrderPricing(cartTotal, discount, 'standard')
    expect(p.finalTotal).toBe(cartTotal - discount + p.shippingFee + p.estimatedTax)
  })

  it('never goes negative when the discount exceeds the cart', () => {
    const p = getOrderPricing(500, 900, 'standard')
    expect(p.estimatedTax).toBeGreaterThanOrEqual(0)
    expect(p.finalTotal).toBeGreaterThanOrEqual(0)
  })

  it('reports how much more is needed for free shipping, and 0 once reached', () => {
    expect(getOrderPricing(3000, 0, 'standard').amountToFreeShipping).toBe(1000)
    expect(getOrderPricing(5000, 0, 'standard').amountToFreeShipping).toBe(0)
  })

  it('reports 0 to free shipping for express, which is never free', () => {
    expect(getOrderPricing(100, 0, 'express').amountToFreeShipping).toBe(0)
  })

  it('falls back to the standard method for an unknown id', () => {
    const unknown = getOrderPricing(1000, 0, 'overnight' as never)
    expect(unknown).toEqual(getOrderPricing(1000, 0, 'standard'))
  })

  it('keeps SHIPPING_METHODS consistent with the exported threshold', () => {
    const standard = SHIPPING_METHODS.find((m) => m.id === 'standard')
    expect(standard?.freeOver).toBe(FREE_SHIPPING_THRESHOLD)
  })
})
