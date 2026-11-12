/* ────────────────────────────────────────────────────────────────────────────
 * Marketing tags: Google Tag Manager and the Meta Pixel.
 *
 * Neither script is in index.html. They load only after the visitor accepts
 * the consent banner (now, or on a previous visit), so nothing reaches Google
 * or Meta from a visitor who declined or has not decided.
 *
 * IDs can be overridden at build time; set either to an empty string to turn
 * that tag off entirely:
 *   VITE_GTM_ID=GTM-XXXXXXX
 *   VITE_META_PIXEL_ID=1234567890
 *
 * Every Meta event is also posted to our own API, which forwards it to Meta's
 * Conversions API with the same event ID (apps/api/src/routes/events.ts).
 * Meta keeps one copy, and the event still arrives when the pixel is blocked.
 * ──────────────────────────────────────────────────────────────────────────── */

import { beacon } from './api'

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: Fbq
  loaded: boolean
  version: string
}

type TagWindow = Window & { dataLayer?: unknown[]; fbq?: Fbq; _fbq?: Fbq }

const envId = (value: unknown, fallback: string) => (typeof value === 'string' ? value.trim() : fallback)

export const GTM_ID = envId(import.meta.env.VITE_GTM_ID, 'GTM-W5MN9LMR')
export const META_PIXEL_ID = envId(import.meta.env.VITE_META_PIXEL_ID, '1702510334659568')

/** True when at least one marketing tag is configured, so the banner must ask. */
export const marketingTagsConfigured = () => Boolean(GTM_ID || META_PIXEL_ID)

let loaded = false

const addScript = (src: string) => {
  const script = document.createElement('script')
  script.async = true
  script.src = src
  document.head.appendChild(script)
}

function loadGtm(w: TagWindow) {
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
  addScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`)

  // The store changes pages without reloading, so GTM is told about each one.
  // In the container, fire the GA4 page_view on this event OR on a History
  // Change trigger, never both, or every page counts twice.
  let last = `${location.pathname}${location.search}`
  const onRoute = () => {
    const current = `${location.pathname}${location.search}`
    if (current === last) return
    last = current
    // After the page has rendered, so the new title is in place.
    window.setTimeout(() => {
      w.dataLayer!.push({ event: 'virtual_page_view', page_path: current, page_location: location.href, page_title: document.title })
    }, 250)
  }
  window.addEventListener('elegantsip:route', onRoute)
  window.addEventListener('popstate', onRoute)
}

/** Meta's standard base code, unminified. */
function loadMetaPixel(w: TagWindow) {
  if (!w.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args)
      else fbq.queue.push(args)
    } as Fbq
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = '2.0'
    fbq.queue = []
    w.fbq = fbq
    if (!w._fbq) w._fbq = fbq
    addScript('https://connect.facebook.net/en_US/fbevents.js')
  }
  const fbq = w.fbq
  // No automatic scraping of page text, metadata or button clicks: Meta gets
  // only the events we send on purpose. Must be set before init.
  fbq('set', 'autoConfig', false, META_PIXEL_ID)
  fbq('init', META_PIXEL_ID)
  // This first PageView is the only manual one. The pixel itself counts later
  // in-app navigations (it watches history.pushState), and dedupes them.
  fbq('track', 'PageView')
}

/** Loads the configured tags once. Call only with the visitor's consent. */
export function loadMarketingTags() {
  if (loaded || typeof window === 'undefined') return
  loaded = true
  const w = window as TagWindow
  if (GTM_ID) loadGtm(w)
  if (META_PIXEL_ID) loadMetaPixel(w)
}

export const marketingTagsLoaded = () => loaded

/** Sends a Meta standard event, if the pixel has loaded. */
export function metaTrack(event: string, data: Record<string, unknown>, eventId?: string) {
  const w = window as TagWindow
  if (!loaded || !META_PIXEL_ID || !w.fbq) return
  if (eventId) w.fbq('track', event, data, { eventID: eventId })
  else w.fbq('track', event, data)
}

/** What the server copy of an event carries. Money in rupees, like the pixel's. */
export interface MetaServerPayload {
  value?: number
  contents?: { id: string; quantity: number }[]
  numItems?: number
  /** Order number, for Purchase: the server reads the value and items from the order. */
  order?: string
}

/** Sends the server-side copy of a pixel event. Call only with the visitor's consent. */
export function metaServerEvent(event: string, eventId: string, payload: MetaServerPayload = {}) {
  if (!META_PIXEL_ID || typeof window === 'undefined') return
  beacon('/v1/events/meta', { event, eventId, url: window.location.href, ...payload })
}

/** A fresh ID shared by the pixel and server copies of one event. */
export function newMetaEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  } catch {
    // Not a secure context.
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
