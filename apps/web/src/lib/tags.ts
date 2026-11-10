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
 * ──────────────────────────────────────────────────────────────────────────── */

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
