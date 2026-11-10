import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./tags', () => ({
  GTM_ID: 'GTM-TEST',
  loadMarketingTags: vi.fn(),
  marketingTagsConfigured: () => true,
  marketingTagsLoaded: () => true,
  metaTrack: vi.fn(),
}))

import { hasAnalyticsConsent, setAnalyticsConsent, track } from './analytics'
import { loadMarketingTags, metaTrack } from './tags'

afterEach(() => {
  vi.restoreAllMocks()
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
  ;(window as { dataLayer?: unknown[] }).dataLayer = []
})

describe('analytics consent', () => {
  it('sends nothing before the visitor accepts', () => {
    track('add_to_cart', { product: 'first-flush', quantity: 1, value: 86_100 })
    expect(metaTrack).not.toHaveBeenCalled()
    expect((window as { dataLayer?: unknown[] }).dataLayer ?? []).toHaveLength(0)
  })

  it('after Accept, sends rupees with INR to GTM and Meta', () => {
    setAnalyticsConsent(true)
    expect(loadMarketingTags).toHaveBeenCalled()
    track('add_to_cart', { product: 'first-flush', quantity: 2, value: 86_100 })
    expect((window as { dataLayer?: unknown[] }).dataLayer).toContainEqual({ event: 'add_to_cart', product: 'first-flush', quantity: 2, value: 861, currency: 'INR' })
    expect(metaTrack).toHaveBeenCalledWith('AddToCart', expect.objectContaining({ value: 861, currency: 'INR', content_ids: ['first-flush'] }))
  })

  it('remembers the choice for the page when the browser blocks storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    setAnalyticsConsent(true)
    expect(hasAnalyticsConsent()).toBe(true)
    track('purchase', { order: 'ES-1', value: 86_100, items: 1 })
    expect(metaTrack).toHaveBeenCalledWith('Purchase', expect.objectContaining({ value: 861 }), 'purchase-ES-1')
  })
})
