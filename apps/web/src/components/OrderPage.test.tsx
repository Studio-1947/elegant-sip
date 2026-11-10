import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InvoiceView, OrderView } from '../lib/api'

const api = vi.hoisted(() => ({ orders: { get: vi.fn(), invoice: vi.fn() } }))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
const auth = vi.hoisted(() => ({ state: { user: null as null | { id: string }, loading: false } }))
vi.mock('./AuthContext', () => ({ useAuth: () => auth.state }))
const ui = vi.hoisted(() => ({ openLogin: vi.fn() }))
vi.mock('./UiContext', () => ({ useUi: () => ui }))
const analytics = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock('../lib/analytics', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/analytics')>()), track: analytics.track }))

import OrderPage from './OrderPage'
import { ApiClientError } from '../lib/api'
import { rememberPendingPurchase } from '../lib/pendingPurchase'

const NUMBER = 'ES-20261110-ABCD'

const order: OrderView = {
  number: NUMBER,
  status: 'paid',
  placedAt: '2026-11-10T05:00:00.000Z',
  paidAt: '2026-11-10T05:01:00.000Z',
  shippedAt: null,
  cancelledAt: null,
  email: 'asha@example.com',
  items: [],
  subtotal: 86_100,
  discount: 0,
  couponCode: null,
  shippingMethod: 'standard',
  shippingFee: 0,
  tax: 4_100,
  total: 86_100,
  shipping: { name: 'Asha Rai', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India' },
  billing: { name: 'Asha Rai', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal', country: 'India' },
  tracking: null,
  shipment: null,
}

const notFound = () => new ApiClientError(404, 'not_found', 'That order could not be found.')

beforeEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
  auth.state = { user: null, loading: false }
})

describe('order page from an email link', () => {
  it('asks a signed-out customer to sign in instead of saying "not found"', async () => {
    api.orders.get.mockRejectedValue(notFound())
    const user = userEvent.setup()
    render(<OrderPage id={NUMBER} />)
    expect(await screen.findByRole('heading', { name: 'Sign in to view this order' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(ui.openLogin).toHaveBeenCalled()
  })

  it('loads the order as soon as the customer signs in, without a reload', async () => {
    api.orders.get.mockRejectedValueOnce(notFound()).mockResolvedValue(order)
    const { rerender } = render(<OrderPage id={NUMBER} />)
    await screen.findByRole('heading', { name: 'Sign in to view this order' })

    auth.state = { user: { id: 'user-1' }, loading: false }
    rerender(<OrderPage id={NUMBER} />)
    expect(await screen.findByRole('heading', { name: NUMBER })).toBeTruthy()
    expect(api.orders.get).toHaveBeenCalledTimes(2)
  })

  it('waits for the sign-in check before asking for the order', async () => {
    auth.state = { user: null, loading: true }
    render(<OrderPage id={NUMBER} />)
    expect(screen.getByText('Loading your order…')).toBeTruthy()
    expect(api.orders.get).not.toHaveBeenCalled()
  })

  it('still says "not found" to a signed-in customer for someone else\'s order', async () => {
    auth.state = { user: { id: 'user-2' }, loading: false }
    api.orders.get.mockRejectedValue(notFound())
    render(<OrderPage id={NUMBER} />)
    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeTruthy()
  })
})

describe('purchases the bank confirms later', () => {
  it('records the purchase once, when the order first shows as paid', async () => {
    auth.state = { user: { id: 'user-1' }, loading: false }
    rememberPendingPurchase(NUMBER)
    api.orders.get.mockResolvedValue({ ...order, items: [{ productSlug: 'first-flush', productName: 'First Flush', variantSize: '100 g', quantity: 2, unitPrice: 43_050, lineTotal: 86_100, imageSrc: '/x.webp' }] })
    const { unmount } = render(<OrderPage id={NUMBER} />)
    await screen.findByRole('heading', { name: NUMBER })
    expect(analytics.track).toHaveBeenCalledWith('purchase', expect.objectContaining({ order: NUMBER, value: 86_100, units: 2 }))
    unmount()

    // Opening the order again does not count it twice.
    analytics.track.mockClear()
    render(<OrderPage id={NUMBER} />)
    await screen.findByRole('heading', { name: NUMBER })
    expect(analytics.track).not.toHaveBeenCalledWith('purchase', expect.anything())
  })
})

describe('invoice button', () => {
  const invoice: InvoiceView = {
    number: 'ES/2026-27/0001',
    issuedAt: '2026-11-10T06:00:00.000Z',
    isTaxInvoice: true,
    sellerGstin: '19ABCDE1234F1Z5',
    placeOfSupply: 'West Bengal',
    hsn: '0902',
    taxRatePercent: 5,
    lines: [],
    totals: { subtotal: '₹861.00', discount: '₹0.00', shipping: 'Free', cgst: '₹20.50', sgst: '₹20.50', igst: null, total: '₹861.00' },
    buyer: { name: 'Asha Rai', line1: '12 Mall Road', city: 'Darjeeling', postalCode: '734101', state: 'West Bengal' },
  }

  const fakePopup = () => {
    const written: string[] = []
    const popup = {
      opener: {} as unknown,
      close: vi.fn(),
      document: { open: vi.fn(() => written.splice(0)), write: vi.fn((html: string) => written.push(html)), close: vi.fn() },
    }
    return { popup, written }
  }

  it('opens the window during the click, then fills it with the invoice', async () => {
    auth.state = { user: { id: 'user-1' }, loading: false }
    api.orders.get.mockResolvedValue(order)
    let deliver: (value: { invoice: InvoiceView }) => void = () => {}
    api.orders.invoice.mockReturnValue(new Promise((resolve) => (deliver = resolve)))
    const { popup, written } = fakePopup()
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const user = userEvent.setup()

    render(<OrderPage id={NUMBER} />)
    await user.click(await screen.findByRole('button', { name: 'Invoice / Print PDF' }))
    // Opened before the invoice arrived, so pop-up blockers allow it.
    expect(open).toHaveBeenCalledTimes(1)
    expect(written.join('')).toContain('Loading')

    deliver({ invoice })
    await waitFor(() => expect(written.join('')).toContain('ES/2026-27/0001'))
    expect(popup.close).not.toHaveBeenCalled()
  })

  it('tells the customer when the browser blocks the window', async () => {
    auth.state = { user: { id: 'user-1' }, loading: false }
    api.orders.get.mockResolvedValue(order)
    vi.spyOn(window, 'open').mockReturnValue(null)
    const user = userEvent.setup()

    render(<OrderPage id={NUMBER} />)
    await user.click(await screen.findByRole('button', { name: 'Invoice / Print PDF' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Allow pop-ups')
    expect(api.orders.invoice).not.toHaveBeenCalled()
  })

  it('closes the window and explains when the invoice is not ready', async () => {
    auth.state = { user: { id: 'user-1' }, loading: false }
    api.orders.get.mockResolvedValue(order)
    api.orders.invoice.mockRejectedValue(new ApiClientError(404, 'not_found', 'An invoice for this order was not found.'))
    const { popup } = fakePopup()
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window)
    const user = userEvent.setup()

    render(<OrderPage id={NUMBER} />)
    await user.click(await screen.findByRole('button', { name: 'Invoice / Print PDF' }))
    expect((await screen.findByRole('alert')).textContent).toContain('An invoice for this order was not found.')
    expect(popup.close).toHaveBeenCalled()
  })
})
