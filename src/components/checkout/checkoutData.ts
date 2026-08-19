/* Checkout form model: field shape, defaults, and per-country postal validation. */

export type Step = 1 | 2 | 3

export const COUNTRIES = ['India', 'United States', 'Canada', 'United Kingdom', 'Australia', 'Other']

export const POSTAL_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  'United States': { pattern: /^\d{5}(-\d{4})?$/, hint: 'Enter a valid US ZIP code (e.g. 97201).' },
  Canada: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, hint: 'Enter a valid Canadian postal code (e.g. V6B 1A1).' },
  'United Kingdom': { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, hint: 'Enter a valid UK postcode (e.g. SW1A 1AA).' },
  Australia: { pattern: /^\d{4}$/, hint: 'Enter a valid Australian postcode (4 digits).' },
  India: { pattern: /^\d{6}$/, hint: 'Enter a valid PIN code (6 digits).' },
}
export const GENERIC_POSTAL = { pattern: /^[A-Za-z\d][A-Za-z\d\s-]{1,9}$/, hint: 'Enter a valid postal code.' }

export interface FormState {
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  zip: string
  country: string
  cardNumber: string
  cardName: string
  expiry: string
  cvc: string
}

export const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  zip: '',
  country: 'India',
  cardNumber: '',
  cardName: '',
  expiry: '',
  cvc: '',
}
