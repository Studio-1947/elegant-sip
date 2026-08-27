/* ────────────────────────────────────────────────────────────────────────────
 * Currency.
 *
 * The whole storefront now works in PAISE, matching the API and the database,
 * so there is exactly one unit in the system and no conversion to get wrong.
 *
 * `formatINR` keeps its name and every existing call site — it just takes paise
 * now. Formatting and the whole-rupee rounding rule live in @elegantsip/shared,
 * shared with the server, so the amount displayed here and the amount charged
 * there cannot drift apart.
 * ──────────────────────────────────────────────────────────────────────────── */

export { formatPaise as formatINR, rupees, RUPEE } from '@elegantsip/shared'
