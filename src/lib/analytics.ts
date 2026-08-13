/* ────────────────────────────────────────────────────────────────────────────
 * Analytics wrapper.
 *
 * Enable by setting env vars at build time:
 *   VITE_ANALYTICS_PROVIDER=plausible|ga4
 *   VITE_ANALYTICS_ID=your-account-id
 *
 * - Plausible: load the script once in index.html (or initAnalytics here),
 *   then events fire via window.plausible.
 * - GA4: pushes { event, ...props } onto window.dataLayer.
 *
 * Without a provider configured, calls no-op (with a console log in dev).
 * ──────────────────────────────────────────────────────────────────────────── */

export type AnalyticsEvent =
  | 'view_page'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'newsletter_signup'
  | 'quiz_completed'
  | 'wishlist_toggle'
  | 'login'
  | 'signup'
  | 'contact_submitted'

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  const provider = import.meta.env.VITE_ANALYTICS_PROVIDER as string | undefined
  if (!provider) return

  if (provider === 'plausible') {
    const w = window as unknown as { plausible?: (e: string, opts: { props: Record<string, unknown> }) => void }
    w.plausible?.(event, { props })
  }

  if (provider === 'ga4') {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...props })
  }

  if (import.meta.env.DEV) {
    console.info(`[analytics] ${event}`, props)
  }
}
