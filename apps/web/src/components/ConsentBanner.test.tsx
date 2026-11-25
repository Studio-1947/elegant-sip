import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const consent = vi.hoisted(() => ({ value: null as boolean | null }))
vi.mock('../lib/analytics', () => ({
  CONSENT_OPEN_EVENT: 'elegantsip:consent-open',
  trackingConfigured: () => true,
  hasAnalyticsConsent: () => consent.value,
  setAnalyticsConsent: vi.fn(),
}))

import ConsentBanner from './ConsentBanner'
import { setAnalyticsConsent } from '../lib/analytics'

beforeEach(() => {
  vi.useFakeTimers()
  consent.value = null
})
afterEach(() => vi.useRealTimers())

const banner = () => screen.queryByRole('dialog', { name: 'Cookie consent' })

describe('cookie banner', () => {
  it('waits a few seconds before asking, instead of covering the page on arrival', () => {
    render(<ConsentBanner />)
    expect(banner()).toBeNull()
    act(() => vi.advanceTimersByTime(8000))
    expect(banner()).toBeTruthy()
  })

  it('asks sooner once the visitor moves to another page', () => {
    render(<ConsentBanner />)
    act(() => {
      window.dispatchEvent(new Event('elegantsip:route'))
    })
    expect(banner()).toBeTruthy()
  })

  it('offers Accept and Decline side by side, and records the choice', () => {
    render(<ConsentBanner />)
    act(() => vi.advanceTimersByTime(8000))
    expect(screen.getByRole('button', { name: 'Accept' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
    expect(setAnalyticsConsent).toHaveBeenCalledWith(false)
    expect(banner()).toBeNull()
  })

  it('does not ask again once a choice is made, but opens from Cookie preferences', () => {
    consent.value = false
    render(<ConsentBanner />)
    act(() => vi.advanceTimersByTime(20000))
    expect(banner()).toBeNull()
    act(() => {
      window.dispatchEvent(new Event('elegantsip:consent-open'))
    })
    expect(banner()).toBeTruthy()
  })
})
