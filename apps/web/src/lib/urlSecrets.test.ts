import { afterEach, describe, expect, it } from 'vitest'
import { clearLinkToken, linkToken, stashUrlToken } from './urlSecrets'

const visit = (url: string) => window.history.replaceState(null, '', url)

afterEach(() => {
  clearLinkToken()
  visit('/')
})

describe('one-time tokens in email links', () => {
  it('moves a reset token out of the address bar before any tag can read it', () => {
    visit('/reset-password?token=secret-reset-token&utm_source=email#top')
    stashUrlToken()
    expect(window.location.href).not.toContain('secret-reset-token')
    // Everything else in the address stays.
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/reset-password?utm_source=email#top')
    expect(linkToken('/reset-password', null)).toBe('secret-reset-token')
  })

  it('keeps the token for a reload of the same page, only for that page', () => {
    visit('/verify-email?token=verify-me')
    stashUrlToken()
    expect(linkToken('/verify-email', null)).toBe('verify-me')
    expect(linkToken('/reset-password', null)).toBe('')
  })

  it('forgets the token once used', () => {
    visit('/reset-password?token=once')
    stashUrlToken()
    clearLinkToken()
    expect(linkToken('/reset-password', null)).toBe('')
  })

  it('leaves other pages alone', () => {
    visit('/shop?token=not-a-secret')
    stashUrlToken()
    expect(window.location.search).toBe('?token=not-a-secret')
  })
})
