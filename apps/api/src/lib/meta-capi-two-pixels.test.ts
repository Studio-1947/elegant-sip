import { afterEach, describe, expect, it, vi } from 'vitest'

// env.ts reads process.env once, at import: both pixels need their tokens first.
vi.hoisted(() => {
  process.env.META_PIXEL_ID = '1111111111'
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-primary-not-real-0123456789'
  process.env.META_PIXEL_ID_SECONDARY = '2222222222'
  process.env.META_CAPI_ACCESS_TOKEN_SECONDARY = 'EAAtest-secondary-not-real-0123456789'
  delete process.env.META_CAPI_TEST_EVENT_CODE
  process.env.META_CAPI_TEST_EVENT_CODE_SECONDARY = 'TEST123'
})

import type { FastifyBaseLogger } from 'fastify'
import { buildServerEvent, metaCapiLastError, metaCapiMode, sendMetaEvents } from './meta-capi.js'

const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as FastifyBaseLogger
const event = buildServerEvent({ event: 'Lead', eventId: 'evt-1', url: 'https://elegantsip.in/', now: new Date('2026-11-10T08:00:00Z') })!

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('Meta Conversions API with two pixels', () => {
  it('is live while either pixel gets real events', () => {
    expect(metaCapiMode()).toBe('live')
  })

  it('sends each event to both pixels, each with its own token and test code', async () => {
    const fetchMock = vi.fn(async () => new Response('{"events_received":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMetaEvents([event], log)).resolves.toBe(true)
    const calls = (fetchMock.mock.calls as unknown as [string, RequestInit][]).map(([url, init]) => [url, JSON.parse(init.body as string)])
    expect(calls).toEqual([
      ['https://graph.facebook.com/v24.0/1111111111/events', { data: [event], access_token: 'EAAtest-primary-not-real-0123456789' }],
      ['https://graph.facebook.com/v24.0/2222222222/events', { data: [event], access_token: 'EAAtest-secondary-not-real-0123456789', test_event_code: 'TEST123' }],
    ])
  })

  it('still delivers to one pixel when the other fails, and says which one failed', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('2222222222')
        ? new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 })
        : new Response('{"events_received":1}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMetaEvents([event], log)).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(metaCapiLastError()).toMatchObject({ pixelId: '2222222222', message: 'Invalid OAuth access token' })
    expect(JSON.stringify((log.warn as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('EAAtest')

    // A success on the other pixel does not hide this one's failure.
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('2222222222') ? new Response('{}', { status: 500 }) : new Response('{"events_received":1}', { status: 200 }),
    )
    await sendMetaEvents([event], log)
    expect(metaCapiLastError()?.pixelId).toBe('2222222222')

    fetchMock.mockImplementation(async () => new Response('{"events_received":1}', { status: 200 }))
    await sendMetaEvents([event], log)
    expect(metaCapiLastError()).toBeNull()
  })
})
