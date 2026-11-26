import { afterEach, describe, expect, it } from 'vitest'
import { readAttribution, storedAttribution } from './attribution'

const at = (href: string, referrer = '') => readAttribution(new URL(href), referrer)

afterEach(() => localStorage.clear())

describe('where a visit came from', () => {
  it('reads the link\'s utm tags', () => {
    expect(at('https://elegantsip.in/shop?utm_source=instagram&utm_medium=paid_social&utm_campaign=diwali&utm_content=reel-1')).toEqual({
      source: 'instagram',
      medium: 'paid_social',
      campaign: 'diwali',
      content: 'reel-1',
      landingPath: '/shop',
    })
  })

  it('notes a Meta or Google ad click without keeping its ID', () => {
    const meta = at('https://elegantsip.in/?fbclid=IwAR0abcdef123')
    expect(meta).toEqual({ click: 'meta', landingPath: '/' })
    expect(JSON.stringify(meta)).not.toContain('IwAR0')
    expect(at('https://elegantsip.in/product/first-flush?gclid=Cj0K123')).toEqual({ click: 'google', landingPath: '/product/first-flush' })
  })

  it('falls back to the referring site, without "www." or Instagram\'s link prefix', () => {
    expect(at('https://elegantsip.in/', 'https://l.instagram.com/?u=x')).toEqual({ referrer: 'instagram.com', landingPath: '/' })
    expect(at('https://elegantsip.in/', 'https://www.google.com/')).toEqual({ referrer: 'google.com', landingPath: '/' })
  })

  it('is nothing for a direct visit or a page of our own site', () => {
    expect(at('https://elegantsip.in/shop')).toBeNull()
    expect(at('https://elegantsip.in/cart', 'https://elegantsip.in/shop')).toBeNull()
  })

  it('keeps the source for 30 days, then forgets it', () => {
    const day = 24 * 60 * 60 * 1000
    localStorage.setItem('elegant_sip_source', JSON.stringify({ source: 'instagram', at: Date.now() - 29 * day }))
    expect(storedAttribution()).toEqual({ source: 'instagram' })
    localStorage.setItem('elegant_sip_source', JSON.stringify({ source: 'instagram', at: Date.now() - 31 * day }))
    expect(storedAttribution()).toBeNull()
    expect(localStorage.getItem('elegant_sip_source')).toBeNull()
  })
})
