import { describe, expect, it } from 'vitest'
import { formatINR } from './currency'

describe('formatINR', () => {
  it('uses Indian digit grouping (lakh/crore), not thousands', () => {
    expect(formatINR(125000)).toBe('₹1,25,000')
    expect(formatINR(2350)).toBe('₹2,350')
  })

  it('never renders paise', () => {
    expect(formatINR(999.6)).not.toContain('.')
  })

  it('renders a non-finite amount as zero rather than "₹NaN"', () => {
    // A NaN reaching the UI is a bug, but showing the customer "₹NaN" is worse.
    expect(formatINR(Number.NaN)).toBe('₹0')
    expect(formatINR(Number.POSITIVE_INFINITY)).toBe('₹0')
  })

  it('handles zero', () => {
    expect(formatINR(0)).toBe('₹0')
  })
})
