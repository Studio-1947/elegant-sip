import { describe, expect, it } from 'vitest'
import { paiseToRupeeInput, parseRestockQuantity, parseRupees } from './adminInput'

describe('parseRupees', () => {
  it('turns whole rupees into paise', () => {
    expect(parseRupees('1299')).toEqual({ ok: true, value: 129900 })
    expect(parseRupees(' ₹1,299 ')).toEqual({ ok: true, value: 129900 })
    expect(parseRupees('599.00')).toEqual({ ok: true, value: 59900 })
    expect(parseRupees('0')).toEqual({ ok: true, value: 0 })
  })

  it('refuses paise, junk, negatives and typos rather than guessing', () => {
    expect(parseRupees('599.50').ok).toBe(false)
    expect(parseRupees('').ok).toBe(false)
    expect(parseRupees('abc').ok).toBe(false)
    expect(parseRupees('-5').ok).toBe(false)
    expect(parseRupees('1e3').ok).toBe(false)
    expect(parseRupees('10000000').ok).toBe(false)
  })

  it('round-trips with the input formatter', () => {
    expect(paiseToRupeeInput(129900)).toBe('1299')
    expect(parseRupees(paiseToRupeeInput(129900))).toEqual({ ok: true, value: 129900 })
  })
})

describe('parseRestockQuantity', () => {
  it('accepts a whole number of packs', () => {
    expect(parseRestockQuantity('12')).toEqual({ ok: true, value: 12 })
  })

  it('refuses zero, fractions, negatives and absurd counts', () => {
    for (const input of ['0', '1.5', '-3', '', 'ten', '20000']) expect(parseRestockQuantity(input).ok).toBe(false)
  })
})
