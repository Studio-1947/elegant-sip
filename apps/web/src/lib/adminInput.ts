import { RUPEE } from '@elegantsip/shared'

/* ────────────────────────────────────────────────────────────────────────────
 * Staff form input.
 *
 * Staff type rupees; the API takes integer paise. The shop prices in whole
 * rupees (GST is rounded to the rupee on that basis), so a price with paise is
 * refused rather than rounded: a silent rounding would change what staff meant.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Well above any pack price; catches a mistyped extra digit. */
const MAX_RUPEES = 999_999

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** "₹1,299" or "1299" → 129900 paise. Whole rupees only. */
export function parseRupees(input: string, label = 'Price'): Parsed<number> {
  const cleaned = input.trim().replace(/^₹\s*/, '').replaceAll(',', '')
  if (!cleaned) return { ok: false, error: `${label} is required.` }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return { ok: false, error: `${label} must be a number of rupees, e.g. 1299.` }
  if (match[2] && Number(match[2]) !== 0) return { ok: false, error: `${label} must be whole rupees; the shop does not price in paise.` }
  const rupees = Number(match[1])
  if (rupees > MAX_RUPEES) return { ok: false, error: `${label} looks too high. Check for an extra digit.` }
  return { ok: true, value: rupees * RUPEE }
}

/** Paise → the plain rupee figure shown in an input, e.g. 129900 → "1299". */
export const paiseToRupeeInput = (paise: number): string => String(Math.round(paise / RUPEE))

/** A count of packs to add: a whole number from 1 to 10,000. */
export function parseRestockQuantity(input: string): Parsed<number> {
  const cleaned = input.trim()
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'Enter a whole number of packs to add.' }
  const quantity = Number(cleaned)
  if (quantity < 1) return { ok: false, error: 'Add at least one pack.' }
  if (quantity > 10_000) return { ok: false, error: 'That is more than 10,000 packs. Check the number.' }
  return { ok: true, value: quantity }
}
