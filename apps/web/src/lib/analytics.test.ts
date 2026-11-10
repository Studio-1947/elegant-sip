import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./tags', () => ({
  GTM_ID: 'GTM-TEST',
  loadMarketingTags: vi.fn(),
  marketingTagsConfigured: () => true,
  marketingTagsLoaded: () => true,
  metaTrack: vi.fn(),
  metaServerEvent: vi.fn(),
  newMetaEventId: () => 'evt-test-1',
}))

import { clearTrackingCookies, hasAnalyticsConsent, purchaseProps, readConsent, setAnalyticsConsent, track } from './analytics'
import { loadMarketingTags, metaServerEvent, metaTrack } from './tags'

const dataLayer = () => (window as { dataLayer?: unknown[] }).dataLayer ?? []
const lastEvent = () => dataLayer()[dataLayer().length - 1] as Record<string, unknown>

beforeEach(() => {
  ;(window as { dataLayer?: unknown[] }).dataLayer = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  try {
    localStorage.clear()
  } catch {
    // ignore
  }
})

describe('consent', () => {
  it('sends nothing before the visitor accepts', () => {
    track('add_to_cart', { product: 'first-flush', quantity: 1, value: 86_100 })
    expect(metaTrack).not.toHaveBeenCalled()
    expect(metaServerEvent).not.toHaveBeenCalled()
    expect(dataLayer()).toHaveLength(0)
  })

  it('records the choice with a date, and asks again after a year', () => {
    setAnalyticsConsent(true)
    const saved = localStorage.getItem('elegant_sip_consent')!
    expect(JSON.parse(saved)).toMatchObject({ v: 1, granted: true })
    expect(readConsent(saved)).toBe(true)
    const day = 24 * 60 * 60 * 1000
    expect(readConsent(JSON.stringify({ v: 1, granted: true, at: Date.now() - 364 * day }))).toBe(true)
    expect(readConsent(JSON.stringify({ v: 1, granted: false, at: Date.now() - 366 * day }))).toBeNull()
    expect(readConsent('not json')).toBeNull()
  })

  it('still honours a choice saved in the old format', () => {
    localStorage.setItem('elegant_sip_consent', 'denied')
    expect(hasAnalyticsConsent()).toBe(false)
    localStorage.setItem('elegant_sip_consent', 'granted')
    expect(hasAnalyticsConsent()).toBe(true)
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
  })

  it('declining removes Google and Meta cookies, and only those', () => {
    document.cookie = '_ga=GA1.1.123; path=/'
    document.cookie = '_fbp=fb.1.123; path=/'
    document.cookie = 'es_cart_hint=1; path=/'
    clearTrackingCookies()
    expect(document.cookie).not.toContain('_ga=')
    expect(document.cookie).not.toContain('_fbp=')
    expect(document.cookie).toContain('es_cart_hint=1')
  })
})

describe('events after Accept', () => {
  beforeEach(() => setAnalyticsConsent(true))

  it('loads the tags', () => {
    expect(loadMarketingTags).toHaveBeenCalled()
  })

  it('sends add-to-cart in GA4 format and to Meta, in rupees', () => {
    track('add_to_cart', { product: 'first-flush', name: 'First Flush', variant: '100 g', quantity: 2, value: 172_200 })
    expect(dataLayer()).toContainEqual({ ecommerce: null })
    expect(lastEvent()).toEqual({
      event: 'add_to_cart',
      ecommerce: {
        currency: 'INR',
        value: 1722,
        items: [{ item_id: 'first-flush', item_name: 'First Flush', item_variant: '100 g', quantity: 2, price: 861 }],
      },
    })
    expect(metaTrack).toHaveBeenCalledWith('AddToCart', expect.objectContaining({ value: 1722, currency: 'INR', content_ids: ['first-flush'] }), 'evt-test-1')
  })

  it('sends a purchase with its order number, every line and the unit count', () => {
    const order = {
      number: 'ES-1',
      total: 215_250,
      items: [
        { productSlug: 'first-flush', productName: 'First Flush', variantSize: '100 g', quantity: 2, unitPrice: 86_100 },
        { productSlug: 'green-tea', productName: 'Green Tea', variantSize: '100 g', quantity: 1, unitPrice: 43_050 },
      ],
    }
    track('purchase', purchaseProps(order))
    const ecommerce = lastEvent().ecommerce as Record<string, unknown>
    expect(ecommerce).toMatchObject({ currency: 'INR', value: 2152.5, transaction_id: 'ES-1' })
    expect(ecommerce.items).toHaveLength(2)
    expect(metaTrack).toHaveBeenCalledWith('Purchase', expect.objectContaining({ value: 2152.5, num_items: 3, content_ids: ['first-flush', 'green-tea'] }), 'purchase-ES-1')
  })

  it('maps the payment step and sign-up to the standard names', () => {
    track('add_payment_info', { value: 86_100, lines: [{ id: 'first-flush', quantity: 1, price: 86_100 }] })
    expect(lastEvent().event).toBe('add_payment_info')
    expect(metaTrack).toHaveBeenCalledWith('AddPaymentInfo', expect.objectContaining({ value: 861 }), 'evt-test-1')
    track('signup', { method: 'email' })
    expect(lastEvent()).toEqual({ event: 'sign_up', method: 'email' })
    expect(metaTrack).toHaveBeenCalledWith('CompleteRegistration', {}, 'evt-test-1')
  })
})

describe('Meta server events (Conversions API)', () => {
  beforeEach(() => setAnalyticsConsent(true))

  it('sends the server copy with the same event ID as the pixel', () => {
    track('add_to_cart', { product: 'first-flush', quantity: 2, value: 172_200 })
    expect(metaServerEvent).toHaveBeenCalledWith('AddToCart', 'evt-test-1', {
      value: 1722,
      contents: [{ id: 'first-flush', quantity: 2 }],
    })
  })

  it('gives a purchase its order number and the order-based ID', () => {
    track('purchase', purchaseProps({
      number: 'ES-9',
      total: 86_100,
      items: [{ productSlug: 'first-flush', productName: 'First Flush', variantSize: '100 g', quantity: 1, unitPrice: 86_100 }],
    }))
    expect(metaTrack).toHaveBeenCalledWith('Purchase', expect.objectContaining({ value: 861 }), 'purchase-ES-9')
    expect(metaServerEvent).toHaveBeenCalledWith('Purchase', 'purchase-ES-9', expect.objectContaining({ order: 'ES-9', numItems: 1 }))
  })

  it('leaves events Meta has no name for out of it entirely', () => {
    track('wishlist_toggle', { product: 'first-flush' })
    track('remove_from_cart', { product: 'first-flush', quantity: 1, value: 86_100 })
    expect(metaTrack).not.toHaveBeenCalled()
    expect(metaServerEvent).not.toHaveBeenCalled()
  })
})
