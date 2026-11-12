import { describe, expect, it } from 'vitest'
import { formatIndianMobile, indianMobileError, normaliseIndianMobile, phoneInputDigits } from './phone.js'

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

  it('keeps a phone field right while the number is typed one key at a time', () => {
    const typed = (text: string) => [...text].reduce((field, key) => phoneInputDigits(field + key), '')
    expect(typed('+91 98765 43210')).toBe('9876543210')
    expect(typed('098765 43210')).toBe('9876543210')
    expect(typed('98765 43210')).toBe('9876543210')
    // An extra digit is kept so the error says "10-digit", rather than silently changing the number.
    expect(typed('98765432109')).toBe('98765432109')
    expect(indianMobileError(typed('98765432109'))).toBe('Enter a 10-digit mobile number.')
    // Pasting or autofill gives the whole value at once.
    expect(phoneInputDigits('+91 98765-43210')).toBe('9876543210')
  })
})
