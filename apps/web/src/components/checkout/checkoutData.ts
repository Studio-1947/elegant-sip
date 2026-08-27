/* Checkout form model: field shape, defaults, and per-country postal validation. */

/* Shipping → Review. There is no card step: the customer never types a card
   into this page, which is what keeps the site out of PCI scope. */
export type Step = 1 | 2

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

/** DOM ids for each field, so validation can move focus to the first error. */
export const FIELD_IDS: Record<string, string> = {
  email: 'co-email',
  firstName: 'co-first',
  lastName: 'co-last',
  address: 'co-address',
  city: 'co-city',
  state: 'co-state',
  zip: 'co-zip',
  country: 'co-country',
}

export interface FormState {
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  /** Indian state — decides the CGST/SGST vs IGST split on the invoice. */
  state: string
  zip: string
  country: string
}

export const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  country: 'India',
}
