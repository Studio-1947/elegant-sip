import { afterEach, describe, expect, it, vi } from 'vitest'

// env.ts reads process.env once, at import, so the token must exist first.
vi.hoisted(() => {
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-token-not-real-0123456789'
  process.env.META_PIXEL_ID = '1234567890'
})

import type { FastifyBaseLogger } from 'fastify'
import { buildServerEvent, metaCapiLastError, metaCapiMode, sendMetaEvents } from './meta-capi.js'

const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as FastifyBaseLogger
const now = new Date('2026-11-10T08:00:00Z')

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('buildServerEvent', () => {
  it('keeps origin and path only, and passes the visitor details Meta matches on', () => {
    const event = buildServerEvent({
      event: 'AddToCart',
      eventId: 'evt-1',
      url: 'https://elegantsip.in/shop/first-flush?token=secret#top',
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      fbp: 'fb.1.1700000000000.123456789',
      customData: { value: 861, currency: 'INR' },
      now,
    })
    expect(event).toEqual({
      event_name: 'AddToCart',
      event_time: Math.floor(now.getTime() / 1000),
      event_id: 'evt-1',
      event_source_url: 'https://elegantsip.in/shop/first-flush',
      action_source: 'website',
      user_data: { client_ip_address: '203.0.113.7', client_user_agent: 'Mozilla/5.0', fbp: 'fb.1.1700000000000.123456789' },
      custom_data: { value: 861, currency: 'INR' },
    })
  })

  it('builds the click ID from fbclid when the pixel has not set _fbc', () => {
    const event = buildServerEvent({ event: 'ViewContent', eventId: 'evt-2', url: 'https://elegantsip.in/?fbclid=AbC_123', now })
    expect(event?.user_data.fbc).toBe(`fb.1.${now.getTime()}.AbC_123`)
  })

  it('drops cookie values that are not Meta’s, and unusable URLs', () => {
    const event = buildServerEvent({ event: 'Lead', eventId: 'evt-3', url: 'https://elegantsip.in/', fbp: '<script>', fbc: 'x', now })
    expect(event?.user_data).toEqual({})
    expect(event).not.toHaveProperty('custom_data')
    expect(buildServerEvent({ event: 'Lead', eventId: 'evt-4', url: 'javascript:alert(1)', now })).toBeNull()
    expect(buildServerEvent({ event: 'Lead', eventId: 'evt-5', url: 'not a url', now })).toBeNull()
  })

  it('never carries personal details', () => {
    const event = buildServerEvent({
      event: 'Purchase',
      eventId: 'purchase-ES-1',
      url: 'https://elegantsip.in/order/ES-1',
      ip: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      fbp: 'fb.1.1700000000000.1',
      fbc: 'fb.1.1700000000000.click',
      now,
    })
    // Meta's hashed email, phone, name and address fields (em, ph, fn, ln, ct, zp…) are never set.
    expect(Object.keys(event!.user_data).sort()).toEqual(['client_ip_address', 'client_user_agent', 'fbc', 'fbp'])
  })
})

describe('sendMetaEvents', () => {
  const event = buildServerEvent({ event: 'Lead', eventId: 'evt-9', url: 'https://elegantsip.in/', now })!

  it('is live once a token is set', () => {
    expect(metaCapiMode()).toBe('live')
  })

  it('posts to the pixel’s events endpoint with the token in the body, not the URL', async () => {
    const fetchMock = vi.fn(async () => new Response('{"events_received":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMetaEvents([event], log)).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://graph.facebook.com/v24.0/1234567890/events')
    expect(url).not.toContain('token')
    expect(JSON.parse(init.body as string)).toEqual({ data: [event], access_token: 'EAAtest-token-not-real-0123456789' })
    expect(metaCapiLastError()).toBeNull()
  })

  it('records Meta’s error without throwing, and never logs the token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token', code: 190 } }), { status: 400 })))
    await expect(sendMetaEvents([event], log)).resolves.toBe(false)
    expect(metaCapiLastError()?.message).toBe('Invalid OAuth access token')
    expect(JSON.stringify((log.warn as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('EAAtest')
  })

  it('survives Meta being unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed') }))
    await expect(sendMetaEvents([event], log)).resolves.toBe(false)
    expect(metaCapiLastError()?.message).toBe('fetch failed')
  })
})
