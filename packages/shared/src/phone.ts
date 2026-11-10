/* ────────────────────────────────────────────────────────────────────────────
 * Indian mobile numbers.
 *
 * One rule for the browser and the server: 10 digits starting 6, 7, 8 or 9.
 * People type and paste numbers in many shapes, so the country code (+91 /
 * 91), a trunk 0, spaces, dashes and brackets are all accepted and removed.
 * ──────────────────────────────────────────────────────────────────────────── */

const LOCAL_MOBILE = /^[6-9]\d{9}$/
/** Anything besides digits and the separators people use means it is not a number. */
const NOT_A_NUMBER = /[^\d\s()+.-]/

/** "+91 98765-43210" → "9876543210". Null when it is not a valid Indian mobile. */
export function normaliseIndianMobile(input: string | null | undefined): string | null {
  if (!input || NOT_A_NUMBER.test(input)) return null
  const digits = input.replace(/\D/g, '')
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits
  return LOCAL_MOBILE.test(local) ? local : null
}

/** A customer-facing reason the number is not usable, or null when it is fine. */
export function indianMobileError(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return 'Enter your mobile number.'
  if (normaliseIndianMobile(input)) return null
  if (NOT_A_NUMBER.test(input)) return 'Use digits only.'
  const digits = input.replace(/\D/g, '')
  const local = digits.length > 10 ? digits.replace(/^(91|0)/, '') : digits
  if (local.length !== 10) return 'Enter a 10-digit mobile number.'
  return 'Indian mobile numbers start with 6, 7, 8 or 9.'
}

/** "9876543210" → "98765 43210", the way the number is usually written. */
export const formatIndianMobile = (local: string) => (local.length === 10 ? `${local.slice(0, 5)} ${local.slice(5)}` : local)
