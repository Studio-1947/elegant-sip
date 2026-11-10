import { describe, expect, it } from 'vitest'
import { financialYearOf } from './invoice.js'

/* The invoice series turns over at midnight in India, not at midnight UTC. */

describe('financialYearOf', () => {
  it('uses the Indian calendar at the 31 March / 1 April boundary', () => {
    // 23:59 IST on 31 March: still the old year.
    expect(financialYearOf(new Date('2027-03-31T18:29:00Z'))).toBe('2026-27')
    // 00:01 IST on 1 April, though UTC still says 31 March: the new year.
    expect(financialYearOf(new Date('2027-03-31T18:31:00Z'))).toBe('2027-28')
  })

  it('handles the turn of the calendar year and century digits', () => {
    expect(financialYearOf(new Date('2027-01-15T06:00:00Z'))).toBe('2026-27')
    expect(financialYearOf(new Date('2099-04-01T00:00:00Z'))).toBe('2099-00')
  })
})
