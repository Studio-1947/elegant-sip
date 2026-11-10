import { describe, expect, it } from 'vitest'
import { formatIndianMobile, indianMobileError, normaliseIndianMobile } from './phone.js'

describe('Indian mobile numbers', () => {
  it('accepts the shapes people actually type and paste', () => {
    for (const input of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '919876543210', '09876543210', '(+91) 98765.43210']) {
      expect(normaliseIndianMobile(input), input).toBe('9876543210')
    }
  })

  it('rejects numbers that cannot be Indian mobiles', () => {
    for (const input of ['', '12345', '5876543210', '98765432101', '+44 7700 900123', '0000000000', 'abc9876543210']) {
      expect(normaliseIndianMobile(input), input).toBeNull()
    }
  })

  it('explains what is wrong', () => {
    expect(indianMobileError('')).toBe('Enter your mobile number.')
    expect(indianMobileError('98765')).toBe('Enter a 10-digit mobile number.')
    expect(indianMobileError('98765432109')).toBe('Enter a 10-digit mobile number.')
    expect(indianMobileError('5876543210')).toBe('Indian mobile numbers start with 6, 7, 8 or 9.')
    expect(indianMobileError('98765abc10')).toBe('Use digits only.')
    expect(indianMobileError('+91 98765 43210')).toBeNull()
  })

  it('formats for display', () => {
    expect(formatIndianMobile('9876543210')).toBe('98765 43210')
  })
})
