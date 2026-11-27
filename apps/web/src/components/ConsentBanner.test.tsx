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

const panel = () => screen.queryByRole('dialog', { name: 'Cookie preferences' })
const openPreferences = () =>
  act(() => {
    window.dispatchEvent(new Event('elegantsip:consent-open'))
  })

describe('cookie preferences', () => {
  it('never pops up by itself: nobody is asked or kept waiting', () => {
    render(<ConsentBanner />)
    act(() => vi.advanceTimersByTime(60_000))
    act(() => {
      window.dispatchEvent(new Event('elegantsip:route'))
    })
    expect(panel()).toBeNull()
  })

  it('opens from Cookie preferences and lets the visitor switch tracking off', () => {
    render(<ConsentBanner />)
    openPreferences()
    expect(screen.getByText(/They are on for you/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Switch off' }))
    expect(setAnalyticsConsent).toHaveBeenCalledWith(false)
    expect(panel()).toBeNull()
  })

  it('says when tracking is off, and can switch it back on', () => {
    consent.value = false
    render(<ConsentBanner />)
    openPreferences()
    expect(screen.getByText(/They are switched off for you/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Allow' }))
    expect(setAnalyticsConsent).toHaveBeenCalledWith(true)
  })
})
