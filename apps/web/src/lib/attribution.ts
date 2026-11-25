/* ────────────────────────────────────────────────────────────────────────────
 * Where a customer came from, for the admin's "Sales by source" report.
 *
 * On arrival, the link's utm_* tags, an ad click (fbclid / gclid, noted only as
 * "meta" or "google", never the ID itself) or else the referring website are
 * kept in this browser for 30 days and sent with the order. A later visit from
 * an ad or another site replaces it; a direct visit keeps what is there.
 *
 * First-party only: it goes to our own server with the order and nowhere else,
 * so it does not wait for the cookie banner. Nothing personal is kept.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface Attribution {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
  click?: 'meta' | 'google'
  referrer?: string
  landingPath?: string
}

const KEY = 'elegant_sip_source'
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const OWN_HOSTS = /(^|\.)elegantsip\.in$/

const clip = (v: string | null | undefined, max = 100) => (v ? v.trim().slice(0, max) : '')

/** The referring site's host, minus "www." and Instagram/Facebook link-shim prefixes. */
function referrerHost(referrer: string, ownHost: string): string {
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^(www|l|lm|m)\./, '')
    if (!host || host === ownHost.replace(/^www\./, '') || OWN_HOSTS.test(host)) return ''
    return host
  } catch {
    return ''
  }
}

/** What this visit says about where it came from; null for a direct visit. */
export function readAttribution(url: URL, referrer: string): Attribution | null {
  const p = url.searchParams
  const found: Attribution = {}
  const set = (key: keyof Omit<Attribution, 'click'>, value: string) => {
    if (value) found[key] = value
  }
  set('source', clip(p.get('utm_source')))
  set('medium', clip(p.get('utm_medium')))
  set('campaign', clip(p.get('utm_campaign')))
  set('content', clip(p.get('utm_content')))
  set('term', clip(p.get('utm_term')))
  if (p.get('fbclid')) found.click = 'meta'
  else if (p.get('gclid') || p.get('gbraid') || p.get('wbraid')) found.click = 'google'
  if (!found.source && !found.click) set('referrer', referrerHost(referrer, url.hostname))
  if (!found.source && !found.medium && !found.campaign && !found.click && !found.referrer) return null
  found.landingPath = clip(url.pathname, 200)
  return found
}

/** Call once on startup. Keeps this visit's source when it has one. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  const found = readAttribution(new URL(window.location.href), document.referrer)
  if (!found) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...found, at: Date.now() }))
  } catch {
    // Storage blocked: this order simply has no source.
  }
}

/** The kept source for the order, if any and not older than 30 days. */
export function storedAttribution(now = Date.now()): Attribution | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const { at, ...kept } = JSON.parse(raw) as Attribution & { at?: number }
    if (typeof at !== 'number' || now - at > MAX_AGE_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return kept
  } catch {
    return null
  }
}
