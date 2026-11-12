import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ storefront: { status: vi.fn() } }))
vi.mock('./api', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api')>()), api }))
vi.mock('./useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('./useMediaQuery', () => ({ useIsMobile: () => false, useMediaQuery: () => false }))

import { __resetStoreSettings, DEFAULT_STOREFRONT_SETTINGS, loadStorefrontSettings, useStoreSettings } from './storeSettings'
import { faqsFor } from '../data/products'
import TrustBadgesSection from '../components/TrustBadgesSection'
import ShippingReturnsPage from '../components/legal/ShippingReturnsPage'
import TermsPage from '../components/legal/TermsPage'

const status = (over: Record<string, unknown> = {}) => ({
  paymentsAvailable: true,
  guestCheckout: false,
  guarantee: { enabled: true, days: 30 },
  ...over,
})

function Probe() {
  const settings = useStoreSettings()
  return <p data-testid="probe">{JSON.stringify(settings)}</p>
}
const probe = () => JSON.parse(screen.getByTestId('probe').textContent ?? '{}')

beforeEach(() => {
  __resetStoreSettings()
  api.storefront.status.mockReset()
})

describe('useStoreSettings', () => {
  it('starts from today’s behaviour: guarantee on for 30 days, no guest checkout', async () => {
    api.storefront.status.mockReturnValue(new Promise(() => {}))
    render(<Probe />)
    expect(probe()).toEqual({ paymentsAvailable: null, guestCheckout: false, guarantee: { enabled: true, days: 30 }, loaded: false })
    expect(DEFAULT_STOREFRONT_SETTINGS.guarantee).toEqual({ enabled: true, days: 30 })
  })

  it('keeps the defaults when the status request fails', async () => {
    api.storefront.status.mockRejectedValue(new Error('offline'))
    render(<Probe />)
    await waitFor(() => expect(api.storefront.status).toHaveBeenCalled())
    await loadStorefrontSettings()
    expect(probe()).toMatchObject({ guestCheckout: false, guarantee: { enabled: true, days: 30 }, loaded: false })
  })

  it('fetches once and shares the answer', async () => {
    api.storefront.status.mockResolvedValue(status({ guestCheckout: true, guarantee: { enabled: true, days: 14 } }))
    render(<><Probe /><Probe /></>)
    await waitFor(() => expect(screen.getAllByTestId('probe')[0].textContent).toContain('"loaded":true'))
    expect(JSON.parse(screen.getAllByTestId('probe')[1].textContent ?? '{}')).toEqual({
      paymentsAvailable: true,
      guestCheckout: true,
      guarantee: { enabled: true, days: 14 },
      loaded: true,
    })
    expect(api.storefront.status).toHaveBeenCalledTimes(1)
  })

  it('ignores missing or impossible values from the server', async () => {
    api.storefront.status.mockResolvedValue({ paymentsAvailable: false, guarantee: { enabled: 'yes', days: 0 } })
    await loadStorefrontSettings()
    render(<Probe />)
    expect(probe()).toEqual({ paymentsAvailable: false, guestCheckout: false, guarantee: { enabled: true, days: 30 }, loaded: true })
  })
})

describe('the satisfaction guarantee', () => {
  it('uses the configured number of days when on', async () => {
    api.storefront.status.mockResolvedValue(status({ guarantee: { enabled: true, days: 45 } }))
    await loadStorefrontSettings()
    const { container } = render(<><TrustBadgesSection /><ShippingReturnsPage /><TermsPage /></>)
    expect(screen.getByText('The Sip Promise')).toBeTruthy()
    expect(screen.getByText('The 45-day taste guarantee')).toBeTruthy()
    expect(container.textContent).toContain('45 days of delivery')
    expect(container.textContent).not.toContain('30-day')
    expect(faqsFor({ enabled: true, days: 45 }).find((f) => f.guarantee)?.answer).toContain('within 45 days')
  })

  it('is not mentioned anywhere when switched off, and the plain policy remains', async () => {
    api.storefront.status.mockResolvedValue(status({ guarantee: { enabled: false, days: 30 } }))
    await loadStorefrontSettings()
    const { container } = render(<><TrustBadgesSection /><ShippingReturnsPage /><TermsPage /></>)
    const text = container.textContent ?? ''
    // "Freshness Guarantee" is a different claim (dated packs) and stays.
    expect(text).not.toMatch(/Sip Promise|satisfaction guarantee|taste guarantee|days of delivery|replace it or refund/i)
    // The parts of the policy that never depended on it are still there.
    expect(text).toContain('Damaged or lost parcels')
    expect(text).toContain('Refunds are issued to the original payment method')
    expect(text).toContain('statutory rights under Indian consumer law')
    expect(faqsFor({ enabled: false, days: 30 }).some((f) => f.guarantee)).toBe(false)
    expect(faqsFor({ enabled: false, days: 30 }).length).toBeGreaterThan(0)
  })
})
