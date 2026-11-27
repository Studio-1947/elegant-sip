import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'

const consent = vi.hoisted(() => ({ value: true }))
vi.mock('../lib/analytics', () => ({
  CONSENT_OPEN_EVENT: 'elegantsip:consent-open',
  trackingConfigured: () => true,
  hasAnalyticsConsent: () => consent.value,
  setAnalyticsConsent: vi.fn(),
}))

import CookiePreferences from './CookiePreferences'
import { setAnalyticsConsent } from '../lib/analytics'

beforeEach(() => {
  vi.useFakeTimers()
  consent.value = true
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

const panel = () => screen.queryByRole('dialog', { name: 'Cookie preferences' })
const openPanel = () =>
  act(() => {
    window.dispatchEvent(new Event('elegantsip:consent-open'))
  })

describe('cookie preferences', () => {
  it('never pops up by itself', () => {
    render(<CookiePreferences />)
    act(() => {
      vi.advanceTimersByTime(30000)
      window.dispatchEvent(new Event('elegantsip:route'))
    })
    expect(panel()).toBeNull()
  })

  it('opens from Cookie preferences with the switch on by default', () => {
    render(<CookiePreferences />)
    openPanel()
    expect(screen.getByRole('switch', { name: 'Ad and analytics cookies' }).getAttribute('aria-checked')).toBe('true')
  })

  it('switching off records the choice', () => {
    render(<CookiePreferences />)
    openPanel()
    fireEvent.click(screen.getByRole('switch', { name: 'Ad and analytics cookies' }))
    expect(setAnalyticsConsent).toHaveBeenCalledWith(false)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })

  it('shows a visitor who switched off that it is off, and lets them turn it back on', () => {
    consent.value = false
    render(<CookiePreferences />)
    openPanel()
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(setAnalyticsConsent).toHaveBeenCalledWith(true)
  })

  it('closes with Done', () => {
    render(<CookiePreferences />)
    openPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(panel()).toBeNull()
  })
})
