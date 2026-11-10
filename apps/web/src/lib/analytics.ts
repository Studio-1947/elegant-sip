import { GTM_ID, loadMarketingTags, marketingTagsConfigured, marketingTagsLoaded, metaTrack } from './tags'

/* ────────────────────────────────────────────────────────────────────────────
 * Analytics wrapper.
 *
 * Nothing is tracked until the visitor accepts the consent banner. After that:
 * - Google Tag Manager and the Meta Pixel load (see tags.ts), and every event
 *   below is pushed to window.dataLayer and mapped to a Meta standard event.
 * - Optionally, VITE_ANALYTICS_PROVIDER=plausible|ga4 adds that provider too.
 *
 * Callers pass money as `value` in PAISE, like the rest of the storefront.
 * It is converted to rupees (with currency INR) before leaving the site,
 * because Google and Meta both expect major units.
 *
 * Never put personal details (email, name, phone, address) in event props.
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

const CONSENT_KEY = 'elegant_sip_consent'
/** Fired to show the consent banner again ("Cookie preferences"). */
export const CONSENT_OPEN_EVENT = 'elegantsip:consent-open'

export function analyticsProvider(): string | undefined {
  return import.meta.env.VITE_ANALYTICS_PROVIDER as string | undefined
}

/** True when anything at all would track, so the banner must ask. */
export const trackingConfigured = () => Boolean(analyticsProvider()) || marketingTagsConfigured()

/** The choice made on this page, for browsers that block storage. */
let consentThisPage: boolean | null = null

/** null = no decision yet. */
export function hasAnalyticsConsent(): boolean | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored === 'granted') return true
    if (stored === 'denied') return false
  } catch {
    // Private mode or blocked storage: fall back to this page's choice.
  }
  return consentThisPage
}

export function setAnalyticsConsent(granted: boolean) {
  const wasLoaded = marketingTagsLoaded()
  consentThisPage = granted
  try {
    localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied')
  } catch {
    // Without storage the choice lasts for this page view only.
  }
  if (granted) {
    loadMarketingTags()
    return
  }
  if (wasLoaded) {
    // Loaded scripts cannot be unloaded; tell Meta to stop, then reload clean.
    ;(window as { fbq?: (...args: unknown[]) => void }).fbq?.('consent', 'revoke')
    window.location.reload()
  }
}

/** Loads tags on startup for a visitor who accepted on an earlier visit. */
export function initAnalytics() {
  if (hasAnalyticsConsent() === true) loadMarketingTags()
}

/** Shows the consent banner again so the visitor can change their choice. */
export function openConsentSettings() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))
}

/** paise → rupees on `value`, plus currency, for every outside destination. */
function outgoingProps(props: Record<string, unknown>) {
  if (typeof props.value !== 'number') return props
  return { ...props, value: props.value / 100, currency: 'INR' }
}

/** Our events → Meta standard events. Unmapped events stay out of Meta. */
function sendToMeta(event: AnalyticsEvent, props: Record<string, unknown>) {
  const value = typeof props.value === 'number' ? { value: props.value, currency: 'INR' } : {}
  const product = typeof props.product === 'string' ? props.product : null
  const quantity = typeof props.quantity === 'number' ? props.quantity : 1
  const contents = product ? { content_ids: [product], content_type: 'product', contents: [{ id: product, quantity }] } : {}

  switch (event) {
    case 'view_item':
      return metaTrack('ViewContent', { ...contents, ...value })
    case 'add_to_cart':
      return metaTrack('AddToCart', { ...contents, ...value })
    case 'begin_checkout':
      // Step 1 opens checkout from the cart; step 2 moves on to payment.
      return metaTrack(props.step === 2 ? 'AddPaymentInfo' : 'InitiateCheckout', value)
    case 'purchase':
      return metaTrack(
        'Purchase',
        { ...value, content_type: 'product', num_items: props.items },
        // Lets Meta drop a duplicate if the same order is ever reported twice.
        typeof props.order === 'string' ? `purchase-${props.order}` : undefined,
      )
    case 'signup':
      return metaTrack('CompleteRegistration', {})
    case 'newsletter_signup':
      return metaTrack('Lead', {})
    case 'contact_submitted':
      return metaTrack('Contact', {})
  }
}

export function track(event: AnalyticsEvent, props: Record<string, unknown> = {}) {
  // Events only fire once the visitor has accepted the consent banner.
  if (hasAnalyticsConsent() !== true) return
  const provider = analyticsProvider()
  const outgoing = outgoingProps(props)

  if (provider === 'plausible') {
    const w = window as unknown as { plausible?: (e: string, opts: { props: Record<string, unknown> }) => void }
    w.plausible?.(event, { props: outgoing })
  }

  // GA4 (gtag) and Google Tag Manager both read window.dataLayer.
  if (provider === 'ga4' || (GTM_ID && marketingTagsLoaded())) {
    const w = window as unknown as { dataLayer?: unknown[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...outgoing })
  }

  const metaProps = typeof props.value === 'number' ? { ...props, value: props.value / 100 } : props
  sendToMeta(event, metaProps)

  if (import.meta.env.DEV) {
    console.info(`[analytics] ${event}`, outgoing)
  }
}
