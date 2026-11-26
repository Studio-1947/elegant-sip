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

/** India's 28 states and 8 union territories, offered as suggestions in the State field. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
]

/** The address line sent to the courier: the street address, then the landmark if one was given. */
export const addressLine = (address: string, landmark: string): string => {
  const street = address.trim()
  const near = landmark.trim()
  return near ? `${street}, Landmark: ${near}` : street
}

/** The reverse of addressLine, for a saved address: its street address and landmark. */
export const splitAddressLine = (line: string): { address: string; landmark: string } => {
  const at = line.lastIndexOf(', Landmark: ')
  return at < 0 ? { address: line, landmark: '' } : { address: line.slice(0, at), landmark: line.slice(at + ', Landmark: '.length) }
}

/** Longest street address + landmark the order accepts (the address line holds 200 characters). */
export const ADDRESS_LINE_MAX = 200

/** Shared with the newsletter form — one email rule for the whole site. */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** DOM ids for each field, so validation can move focus to the first error. */
export const FIELD_IDS: Record<string, string> = {
  email: 'co-email',
  phone: 'co-phone',
  firstName: 'co-first',
  lastName: 'co-last',
  address: 'co-address',
  city: 'co-city',
  state: 'co-state',
  landmark: 'co-landmark',
  zip: 'co-zip',
  country: 'co-country',
}

export interface FormState {
  email: string
  /** Couriers will not accept a shipment without the recipient's mobile. */
  phone: string
  firstName: string
  lastName: string
  address: string
  /** Optional. Couriers in India lean on it; sent as part of the address line. */
  landmark: string
  city: string
  /** Indian state — decides the CGST/SGST vs IGST split on the invoice. */
  state: string
  zip: string
  country: string
}

export const EMPTY_FORM: FormState = {
  email: '',
  phone: '',
  firstName: '',
  lastName: '',
  address: '',
  landmark: '',
  city: '',
  state: '',
  zip: '',
  country: 'India',
}
