/* Checkout form model: field shape, defaults, and per-country postal validation. */

export type Step = 1 | 2 | 3

/* Only India is offered at checkout: it is the region Terms commits to, and
   the one we can quote a real rate for. Everywhere else is arranged by hand —
   see the Shipping page. */
export const COUNTRIES = ['India']

export const POSTAL_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  // A PIN code never starts with 0.
  India: { pattern: /^[1-9]\d{5}$/, hint: 'Enter a valid 6-digit PIN code (e.g. 734101).' },
  'United States': { pattern: /^\d{5}(-\d{4})?$/, hint: 'Enter a valid US ZIP code (e.g. 97201).' },
  // Canada Post never uses D, F, I, O, Q or U in a postal code.
  Canada: {
    pattern: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    hint: 'Enter a valid Canadian postal code (e.g. V6B 1A1).',
  },
  'United Kingdom': { pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$/, hint: 'Enter a valid UK postcode (e.g. SW1A 1AA).' },
  Australia: { pattern: /^\d{4}$/, hint: 'Enter a valid Australian postcode (4 digits).' },
}
export const GENERIC_POSTAL = { pattern: /^[A-Za-z\d][A-Za-z\d\s-]{1,9}$/, hint: 'Enter a valid postal code.' }

/** Shared with the newsletter form — one email rule for the whole site. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Luhn checksum — catches transposed and mistyped card digits. */
export function luhn(pan: string): boolean {
  let sum = 0
  let double = false
  for (let i = pan.length - 1; i >= 0; i--) {
    let digit = pan.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/** DOM ids for each field, so validation can move focus to the first error. */
export const FIELD_IDS: Record<string, string> = {
  email: 'co-email',
  firstName: 'co-first',
  lastName: 'co-last',
  address: 'co-address',
  city: 'co-city',
  zip: 'co-zip',
  country: 'co-country',
  cardNumber: 'co-card',
  cardName: 'co-cardname',
  expiry: 'co-expiry',
  cvc: 'co-cvc',
}

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
