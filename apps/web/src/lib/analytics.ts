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
 * because Google and Meta both expect major units. Ecommerce events reach
 * Google Tag Manager in GA4's format (an `ecommerce` object with `items`).
 *
 * Never put personal details (email, name, phone, address) in event props.
 * ──────────────────────────────────────────────────────────────────────────── */

export type AnalyticsEvent =
  | 'view_page'
  | 'view_item'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'purchase'
  | 'newsletter_signup'
  | 'quiz_completed'
  | 'wishlist_toggle'
  | 'login'
  | 'signup'
  | 'contact_submitted'

/** One product line in an event. `price` is per unit, in paise. */
export interface TrackedLine {
  id: string
  name?: string
  variant?: string
  quantity: number
  price: number
}

const CONSENT_KEY = 'elegant_sip_consent'
/** A choice is asked for again after a year, as consent should not last forever. */
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000
/** Fired to show the consent banner again ("Cookie preferences"). */
export const CONSENT_OPEN_EVENT = 'elegantsip:consent-open'

export function analyticsProvider(): string | undefined {
  return import.meta.env.VITE_ANALYTICS_PROVIDER as string | undefined
}

/** True when anything at all would track, so the banner must ask. */
export const trackingConfigured = () => Boolean(analyticsProvider()) || marketingTagsConfigured()

/** The choice made on this page, for browsers that block storage. */
let consentThisPage: boolean | null = null

interface ConsentRecord {
  v: 1
  granted: boolean
  /** When the choice was made, ms since epoch. */
  at: number
}

/** A stored choice, or null when there is none or it has expired. Exported for tests. */
export function readConsent(raw: string | null): boolean | null {
  if (!raw) return null
  // Choices saved before records carried a date.
  if (raw === 'granted') return true
  if (raw === 'denied') return false
  try {
    const record = JSON.parse(raw) as Partial<ConsentRecord>
    if (record.v !== 1 || typeof record.granted !== 'boolean' || typeof record.at !== 'number') return null
    return Date.now() - record.at > CONSENT_MAX_AGE_MS ? null : record.granted
  } catch {
    return null
  }
}

/** null = no decision yet (or the last one has expired). */
export function hasAnalyticsConsent(): boolean | null {
  try {
    const stored = readConsent(localStorage.getItem(CONSENT_KEY))
    if (stored !== null) return stored
  } catch {
    // Private mode or blocked storage: fall back to this page's choice.
  }
  return consentThisPage
}

/** Google Analytics, Google Ads and Meta cookies, which only exist after consent. */
const TRACKING_COOKIE = /^(_ga|_gid|_gat|_gcl_|_fbp|_fbc)/

/** Deletes those cookies on every domain they may have been set for. */
export function clearTrackingCookies() {
  const host = window.location.hostname
  const parts = host.split('.')
  const domains = ['', host, `.${host}`, ...(parts.length > 2 ? [`.${parts.slice(-2).join('.')}`] : [])]
  for (const cookie of document.cookie.split(';')) {
    const name = cookie.split('=')[0]?.trim()
    if (!name || !TRACKING_COOKIE.test(name)) continue
    for (const domain of domains) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`
    }
  }
}

export function setAnalyticsConsent(granted: boolean) {
  const wasLoaded = marketingTagsLoaded()
  consentThisPage = granted
  try {
    const record: ConsentRecord = { v: 1, granted, at: Date.now() }
    localStorage.setItem(CONSENT_KEY, JSON.stringify(record))
  } catch {
    // Without storage the choice lasts for this page view only.
  }
  if (granted) {
    loadMarketingTags()
    return
  }
  clearTrackingCookies()
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

/* ── Building events ──────────────────────────────────────────────────────── */

type OrderItem = { productSlug: string; productName: string; variantSize: string; quantity: number; unitPrice: number }
type CartEntry = { productSlug: string; name: string; size: string; quantity: number; price: number }

/** An order's lines, for purchase events. */
export const orderLines = (items: OrderItem[]): TrackedLine[] =>
  items.map((i) => ({ id: i.productSlug, name: i.productName, variant: i.variantSize, quantity: i.quantity, price: i.unitPrice }))

/** A cart's lines, for checkout events. */
export const cartLines = (cart: CartEntry[]): TrackedLine[] =>
  cart.map((i) => ({ id: i.productSlug, name: i.name, variant: i.size, quantity: i.quantity, price: i.price }))

const unitsOf = (lines: TrackedLine[]) => lines.reduce((sum, line) => sum + line.quantity, 0)

/** Everything a purchase event needs, from the order itself. */
export function purchaseProps(order: { number: string; total: number; items: OrderItem[] }) {
  const lines = orderLines(order.items)
  return { order: order.number, value: order.total, units: unitsOf(lines), lines }
}

/** The product lines an event is about: explicit lines, or the single product it names. */
function linesOf(props: Record<string, unknown>): TrackedLine[] {
  if (Array.isArray(props.lines)) return props.lines as TrackedLine[]
  if (typeof props.product !== 'string') return []
  const quantity = typeof props.quantity === 'number' ? props.quantity : 1
  const line: TrackedLine = {
    id: props.product,
    quantity,
    price: typeof props.value === 'number' ? Math.round(props.value / quantity) : 0,
  }
  if (typeof props.name === 'string') line.name = props.name
  if (typeof props.variant === 'string') line.variant = props.variant
  return [line]
}

const rupees = (paise: number) => paise / 100

/** Props as sent outside: money in rupees with its currency, no internal line list. */
function flatProps(props: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...props }
  delete rest.lines
  return typeof rest.value === 'number' ? { ...rest, value: rupees(rest.value), currency: 'INR' } : rest
}

/** GA4's ecommerce events; their data goes in an `ecommerce` object with an item list. */
const ECOMMERCE_EVENTS = new Set<AnalyticsEvent>(['view_item', 'add_to_cart', 'remove_from_cart', 'begin_checkout', 'add_payment_info', 'purchase'])
/** GA4's recommended names where ours differ. */
const GA_NAMES: Partial<Record<AnalyticsEvent, string>> = { signup: 'sign_up' }

function pushToDataLayer(event: AnalyticsEvent, props: Record<string, unknown>) {
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  const name = GA_NAMES[event] ?? event
  if (!ECOMMERCE_EVENTS.has(event)) {
    w.dataLayer.push({ event: name, ...flatProps(props) })
    return
  }
  // Clears the previous event's ecommerce data, as Google recommends.
  w.dataLayer.push({ ecommerce: null })
  w.dataLayer.push({
    event: name,
    ecommerce: {
      currency: 'INR',
      ...(typeof props.value === 'number' ? { value: rupees(props.value) } : {}),
      ...(typeof props.order === 'string' ? { transaction_id: props.order } : {}),
      items: linesOf(props).map((line) => ({
        item_id: line.id,
        ...(line.name ? { item_name: line.name } : {}),
        ...(line.variant ? { item_variant: line.variant } : {}),
        quantity: line.quantity,
        price: rupees(line.price),
      })),
    },
  })
}

/** Our events → Meta standard events. Unmapped events stay out of Meta. */
function sendToMeta(event: AnalyticsEvent, props: Record<string, unknown>) {
  const lines = linesOf(props)
  const value = typeof props.value === 'number' ? { value: rupees(props.value), currency: 'INR' } : {}
  const contents = lines.length
    ? { content_ids: lines.map((l) => l.id), content_type: 'product', contents: lines.map((l) => ({ id: l.id, quantity: l.quantity })) }
    : {}

  switch (event) {
    case 'view_item':
      return metaTrack('ViewContent', { ...contents, ...value })
    case 'add_to_cart':
      return metaTrack('AddToCart', { ...contents, ...value })
    case 'begin_checkout':
      return metaTrack('InitiateCheckout', { ...contents, ...value, num_items: unitsOf(lines) })
    case 'add_payment_info':
      return metaTrack('AddPaymentInfo', { ...contents, ...value })
    case 'purchase':
      return metaTrack(
        'Purchase',
        { ...contents, ...value, num_items: typeof props.units === 'number' ? props.units : unitsOf(lines) },
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

  if (provider === 'plausible') {
    const w = window as unknown as { plausible?: (e: string, opts: { props: Record<string, unknown> }) => void }
    w.plausible?.(event, { props: flatProps(props) })
  }

  // GA4 (gtag) and Google Tag Manager both read window.dataLayer.
  if (provider === 'ga4' || (GTM_ID && marketingTagsLoaded())) pushToDataLayer(event, props)

  sendToMeta(event, props)

  if (import.meta.env.DEV) {
    console.info(`[analytics] ${event}`, props)
  }
}
