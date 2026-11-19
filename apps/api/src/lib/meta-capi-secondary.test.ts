import { afterEach, describe, expect, it, vi } from 'vitest'

// env.ts reads process.env once, at import: both pixels have tokens; only the second has a test code.
vi.hoisted(() => {
  process.env.META_PIXEL_ID = '1234567890'
  process.env.META_CAPI_ACCESS_TOKEN = 'EAAtest-primary-not-real-0123456789'
  delete process.env.META_CAPI_TEST_EVENT_CODE
  process.env.META_PIXEL_ID_SECONDARY = '9876543210'
  process.env.META_CAPI_ACCESS_TOKEN_SECONDARY = 'EAAtest-secondary-not-real-0123456789'
  process.env.META_CAPI_TEST_EVENT_CODE_SECONDARY = 'TEST123'
})

import type { FastifyBaseLogger } from 'fastify'
import { buildServerEvent, metaCapiActive, metaCapiLastError, metaCapiMode, sendMetaEvents } from './meta-capi.js'

const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn() } as unknown as FastifyBaseLogger
const event = buildServerEvent({ event: 'Lead', eventId: 'evt-1', url: 'https://elegantsip.in/', now: new Date('2026-11-19T08:00:00Z') })!

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

const bodyFor = (fetchMock: ReturnType<typeof vi.fn>, pixelId: string) => {
  const call = fetchMock.mock.calls.find(([url]) => String(url).includes(`/${pixelId}/events`)) as [string, RequestInit] | undefined
  return call ? JSON.parse(call[1].body as string) : undefined
}

describe('the second (Studio 1947) pixel', () => {
  it('is on with its own token, in its own mode', () => {
    expect(metaCapiMode()).toBe('live')
    expect(metaCapiMode('secondary')).toBe('test')
    expect(metaCapiActive()).toBe(true)
  })

  it('gets the same events with its own token and test code; the main pixel is unchanged', async () => {
    const fetchMock = vi.fn(async () => new Response('{"events_received":1}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMetaEvents([event], log)).resolves.toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(bodyFor(fetchMock, '1234567890')).toEqual({ data: [event], access_token: 'EAAtest-primary-not-real-0123456789' })
    expect(bodyFor(fetchMock, '9876543210')).toEqual({
      data: [event],
      access_token: 'EAAtest-secondary-not-real-0123456789',
      test_event_code: 'TEST123',
    })
  })

  it('failing does not stop the main pixel, and its error is labelled', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('/9876543210/')
        ? new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), { status: 400 })
        : new Response('{"events_received":1}', { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendMetaEvents([event], log)).resolves.toBe(false)
    expect(bodyFor(fetchMock, '1234567890')).toBeDefined()
    expect(metaCapiLastError()?.message).toBe('Studio 1947 pixel: Invalid OAuth access token')
    expect(JSON.stringify((log.warn as ReturnType<typeof vi.fn>).mock.calls)).not.toContain('EAAtest')

    // Its next success clears it.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"events_received":1}', { status: 200 })))
    await sendMetaEvents([event], log)
    expect(metaCapiLastError()).toBeNull()
  })
})
