import type { FastifyBaseLogger } from 'fastify'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Meta Conversions API: the server-side copy of the Meta Pixel's events.
 *
 * The storefront fires each pixel event in the browser AND posts it to
 * /v1/events/meta, which forwards it here with the same event ID. Meta keeps
 * one of the two, so nothing counts twice, and an event still arrives when an
 * ad-blocker stops the pixel script.
 *
 * Consent is decided in the browser: the storefront posts only for visitors
 * who accepted the cookie banner, the same rule as the pixel itself.
 *
 * What Meta receives matches the privacy policy: the event and its product
 * data, the page, IP address, browser type and Meta's own cookie IDs (_fbp,
 * _fbc). Never a name, email address, phone number or address.
 *
 * Each event goes to every configured pixel: Elegant Sip's own and Studio
 * 1947's (META_PIXEL_ID_SECONDARY). Each pixel has its own token and test
 * code, and is on or off by itself.
 *
 * Failures never reach the visitor. They are logged, and the latest one is
 * shown on the admin page (an expired token would otherwise go unnoticed).
 * ──────────────────────────────────────────────────────────────────────────── */

export const META_EVENTS = [
  'ViewContent',
  'AddToCart',
  'InitiateCheckout',
  'AddPaymentInfo',
  'Purchase',
  'CompleteRegistration',
  'Lead',
  'Contact',
] as const
export type MetaEventName = (typeof META_EVENTS)[number]

export interface MetaCustomData {
  /** Rupees, not paise: Meta expects major units. */
  value?: number
  currency?: 'INR'
  content_ids?: string[]
  /** Slugs are sent as content_ids; the feed's item_group_id is the slug. */
  content_type?: 'product_group'
  contents?: { id: string; quantity: number }[]
  num_items?: number
  order_id?: string
}

export interface MetaServerEvent {
  event_name: MetaEventName
  event_time: number
  event_id: string
  event_source_url: string
  action_source: 'website'
  user_data: {
    client_ip_address?: string
    client_user_agent?: string
    fbp?: string
    fbc?: string
  }
  custom_data?: MetaCustomData
}

export interface ServerEventInput {
  event: MetaEventName
  eventId: string
  /** The page, as the browser reported it. Only origin and path are kept. */
  url: string
  ip?: string
  userAgent?: string
  /** The `_fbp` and `_fbc` cookies, when the pixel has set them. */
  fbp?: string
  fbc?: string
  customData?: MetaCustomData
  now?: Date
}

/** Meta's own cookie values: `fb.<n>.<timestamp>.<id>`. Anything else is dropped. */
const META_COOKIE = /^fb\.\d\.\d{10,16}\.[\w.-]{1,500}$/

/** True for a value shaped like Meta's own `_fbp` / `_fbc` cookies. */
export const isMetaCookie = (value: string) => META_COOKIE.test(value)

/** The pixel builds _fbc from a `fbclid` in the URL; done here too, for when it is blocked. */
function clickIdFrom(url: URL, now: Date): string | undefined {
  const fbclid = url.searchParams.get('fbclid')?.trim()
  if (!fbclid || !/^[\w.-]{1,500}$/.test(fbclid)) return undefined
  return `fb.1.${now.getTime()}.${fbclid}`
}

/** The event as Meta's API takes it. Null when the URL is unusable. */
export function buildServerEvent(input: ServerEventInput): MetaServerEvent | null {
  const now = input.now ?? new Date()
  let url: URL
  try {
    url = new URL(input.url)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const fbp = input.fbp && META_COOKIE.test(input.fbp) ? input.fbp : undefined
  const fbc = input.fbc && META_COOKIE.test(input.fbc) ? input.fbc : clickIdFrom(url, now)
  const userAgent = input.userAgent?.slice(0, 512)

  const userData: MetaServerEvent['user_data'] = {}
  if (input.ip) userData.client_ip_address = input.ip
  if (userAgent) userData.client_user_agent = userAgent
  if (fbp) userData.fbp = fbp
  if (fbc) userData.fbc = fbc

  return {
    event_name: input.event,
    event_time: Math.floor(now.getTime() / 1000),
    event_id: input.eventId,
    // No query string: links can carry tokens and order references.
    event_source_url: url.origin + url.pathname,
    action_source: 'website',
    user_data: userData,
    ...(input.customData && Object.keys(input.customData).length > 0 ? { custom_data: input.customData } : {}),
  }
}

export type MetaCapiMode = 'off' | 'test' | 'live'

interface MetaPixelTarget {
  pixelId: string
  token: string
  testCode?: string
}

/** The pixels that receive server events now, each with its own token. */
export function metaCapiTargets(): MetaPixelTarget[] {
  const configured = [
    { pixelId: env.META_PIXEL_ID, token: env.META_CAPI_ACCESS_TOKEN, testCode: env.META_CAPI_TEST_EVENT_CODE },
    { pixelId: env.META_PIXEL_ID_SECONDARY, token: env.META_CAPI_ACCESS_TOKEN_SECONDARY, testCode: env.META_CAPI_TEST_EVENT_CODE_SECONDARY },
  ]
  const seen = new Set<string>()
  const targets: MetaPixelTarget[] = []
  for (const { pixelId, token, testCode } of configured) {
    if (!pixelId || !token || seen.has(pixelId)) continue
    // A development server takes fake payments: its events must never reach a
    // live pixel and skew real ad results. Locally, only test events are sent.
    if (!testCode && env.NODE_ENV === 'development') continue
    seen.add(pixelId)
    targets.push({ pixelId, token, ...(testCode ? { testCode } : {}) })
  }
  return targets
}

/** 'live' when any pixel gets real events, 'test' when all get test events only. */
export function metaCapiMode(): MetaCapiMode {
  const targets = metaCapiTargets()
  if (targets.length === 0) return 'off'
  return targets.every((t) => t.testCode) ? 'test' : 'live'
}

/** Each pixel's latest failure, cleared by that pixel's next success. */
const lastErrors = new Map<string, { at: Date; message: string; pixelId: string }>()
/** The most recent failure across pixels. For the admin page. */
export const metaCapiLastError = () => {
  let latest: { at: Date; message: string; pixelId: string } | null = null
  for (const error of lastErrors.values()) if (!latest || error.at >= latest.at) latest = error
  return latest
}

/** Logs a failure at most once a minute, so a dead token does not flood the logs. */
let lastWarnAt = 0
function fail(log: FastifyBaseLogger, pixelId: string, message: string, details: Record<string, unknown> = {}) {
  lastErrors.set(pixelId, { at: new Date(), message, pixelId })
  if (Date.now() - lastWarnAt < 60_000) return
  lastWarnAt = Date.now()
  log.warn({ metaCapi: { pixelId, message, ...details } }, 'meta conversions api: events not delivered')
}

/** Sends events to every configured pixel. Resolves to whether all accepted them; never throws. */
export async function sendMetaEvents(events: MetaServerEvent[], log: FastifyBaseLogger): Promise<boolean> {
  const targets = metaCapiTargets()
  if (targets.length === 0 || events.length === 0) return false
  const results = await Promise.all(targets.map((target) => sendToPixel(target, events, log)))
  return results.every(Boolean)
}

async function sendToPixel({ pixelId, token, testCode }: MetaPixelTarget, events: MetaServerEvent[], log: FastifyBaseLogger): Promise<boolean> {
  const endpoint = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${pixelId}/events`
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // The token goes in the body, never the URL, so it cannot end up in a log line.
      body: JSON.stringify({
        data: events,
        access_token: token,
        ...(testCode ? { test_event_code: testCode } : {}),
      }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: unknown; code?: unknown } } | null
      const message = typeof body?.error?.message === 'string' ? body.error.message.slice(0, 300) : `HTTP ${response.status}`
      fail(log, pixelId, message, { status: response.status, code: body?.error?.code })
      return false
    }
    lastErrors.delete(pixelId)
    return true
  } catch (err) {
    fail(log, pixelId, err instanceof Error ? err.message : 'request failed')
    return false
  }
}
