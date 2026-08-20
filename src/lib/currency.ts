/* ────────────────────────────────────────────────────────────────────────────
 * Currency formatting  the store prices everything in Indian Rupees.
 * All amounts are whole rupees (no paise), formatted with Indian digit
 * grouping, e.g. 2350 → "₹2,350" and 125000 → "₹1,25,000".
 * ──────────────────────────────────────────────────────────────────────────── */

const formatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export const formatINR = (amount: number): string => formatter.format(amount)
