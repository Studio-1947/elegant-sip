/* ────────────────────────────────────────────────────────────────────────────
 * Dates, written the Indian way and in Indian time.
 *
 * The shop, its couriers and its customers are in India, so every date is
 * shown in IST whatever time zone the visitor's device is set to. Otherwise a
 * parcel delivered at 1 am IST shows as "yesterday" on a phone set to London.
 * ──────────────────────────────────────────────────────────────────────────── */

const TIME_ZONE = 'Asia/Kolkata'

/** "12 March 2026". */
export const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: TIME_ZONE })

/** "12 Mar 2026". */
export const formatShortDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium', timeZone: TIME_ZONE })

/** "12 Mar". */
export const formatDayMonth = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: TIME_ZONE })

/** "12 Mar 2026, 2:30 pm". */
export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: TIME_ZONE })
