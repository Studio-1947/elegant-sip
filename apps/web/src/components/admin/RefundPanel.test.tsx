import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ApiClientError, type AdminRefundLedger } from '../../lib/api'

const api = vi.hoisted(() => ({
  adminRefunds: { get: vi.fn(), create: vi.fn() },
  admin: { updateOrder: vi.fn() },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), api }))

import RefundPanel, { parseRefundAmount } from './RefundPanel'

const ledger = (overrides: Partial<AdminRefundLedger> = {}): AdminRefundLedger => ({
  captured: 130_000,
  refunded: 0,
  pending: 0,
  refundable: 130_000,
  orderStatus: 'paid',
  cancelAdvised: false,
  refunds: [],
  ...overrides,
})

const processed = {
  id: crypto.randomUUID(),
  amount: 130_000,
  status: 'processed' as const,
  reason: 'Cancelled before dispatch',
  failureReason: null,
  providerRefundId: 'rfnd_1',
  requestedBy: 'Staff',
  createdAt: '2026-11-10T08:00:00.000Z',
  processedAt: '2026-11-10T08:00:01.000Z',
}

beforeEach(() => {
  api.adminRefunds.get.mockReset()
  api.adminRefunds.create.mockReset()
  api.admin.updateOrder.mockReset()
  api.adminRefunds.get.mockResolvedValue(ledger())
})

describe('parseRefundAmount', () => {
  it('takes whole rupees and returns paise', () => {
    expect(parseRefundAmount('300', 130_000, false)).toEqual({ ok: true, value: 30_000 })
    expect(parseRefundAmount('₹1,300', 130_000, false)).toEqual({ ok: true, value: 130_000 })
  })

  it('refuses paise, zero, and more than remains', () => {
    expect(parseRefundAmount('299.50', 130_000, false).ok).toBe(false)
    expect(parseRefundAmount('0', 130_000, false)).toEqual({ ok: false, error: 'Refund at least ₹1.' })
    expect(parseRefundAmount('1301', 130_000, false)).toEqual({ ok: false, error: 'At most ₹1,300 can be refunded on this order.' })
    expect(parseRefundAmount('', 130_000, false).ok).toBe(false)
  })

  it('"full remaining" refunds the exact remaining paise, even a part rupee', () => {
    expect(parseRefundAmount('1000', 100_050, true)).toEqual({ ok: true, value: 100_050 })
    expect(parseRefundAmount('1', 0, true).ok).toBe(false)
  })
})

describe('RefundPanel', () => {
  const fillAndReview = async (amount: string | 'full') => {
    render(<RefundPanel orderNumber="ES-1" onChanged={() => {}} />)
    if (amount === 'full') fireEvent.click(await screen.findByRole('button', { name: /Full remaining/ }))
    else fireEvent.change(await screen.findByLabelText(/Amount/), { target: { value: amount } })
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'Cancelled before dispatch' } })
    fireEvent.click(screen.getByRole('button', { name: 'Review refund' }))
  }

  it('confirms the exact amount, sends paise with a key, and reports only what the API said', async () => {
    api.adminRefunds.create.mockResolvedValue({
      refund: processed,
      ledger: ledger({ refunded: 130_000, refundable: 0, refunds: [processed] }),
      replayed: false,
      emailed: false,
      advice: null,
    })
    await fillAndReview('full')

    expect(screen.getByText(/This cannot be undone/).innerHTML).toContain('₹1,300')
    expect(api.adminRefunds.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Refund ₹1,300' }))

    await waitFor(() => expect(api.adminRefunds.create).toHaveBeenCalled())
    const [number, payload] = api.adminRefunds.create.mock.calls[0]
    expect(number).toBe('ES-1')
    expect(payload).toMatchObject({ amount: 130_000, reason: 'Cancelled before dispatch' })
    expect(payload.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    const status = await screen.findByRole('status')
    expect(status.textContent).toContain('Refunded ₹1,300.')
    // emailed: false must not read as sent.
    expect(status.textContent).toContain('was not sent')
    expect(status.textContent).not.toContain('customer was emailed')
  })

  it('refuses more than remains without calling the API', async () => {
    await fillAndReview('2000')
    expect((await screen.findByRole('alert')).textContent).toBe('At most ₹1,300 can be refunded on this order.')
    expect(screen.queryByText(/This cannot be undone/)).toBeNull()
  })

  it('shows the API error verbatim, and reuses the key only when no answer came back', async () => {
    api.adminRefunds.create
      .mockRejectedValueOnce(new ApiClientError(0, 'network_error', 'Could not reach the shop.'))
      .mockRejectedValueOnce(new ApiClientError(409, 'refund_exceeds_remaining', 'At most ₹300 can be refunded on this order.'))
    await fillAndReview('500')

    fireEvent.click(screen.getByRole('button', { name: 'Refund ₹500' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the shop.')
    // Still confirming, with the same key, so a retry cannot refund twice.
    fireEvent.click(screen.getByRole('button', { name: 'Refund ₹500' }))
    await waitFor(() => expect(api.adminRefunds.create).toHaveBeenCalledTimes(2))
    const keys = api.adminRefunds.create.mock.calls.map((call) => call[1].idempotencyKey)
    expect(keys[0]).toBe(keys[1])
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('At most ₹300 can be refunded on this order.'))
    expect(screen.queryByText(/This cannot be undone/)).toBeNull()
  })

  it('advises cancelling a fully refunded order that has not shipped', async () => {
    api.adminRefunds.get.mockResolvedValue(ledger({ refunded: 130_000, refundable: 0, cancelAdvised: true, refunds: [processed] }))
    api.admin.updateOrder.mockResolvedValue({ ok: true, notified: false, refundDue: false })
    render(<RefundPanel orderNumber="ES-1" onChanged={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel order' }))
    await waitFor(() => expect(api.admin.updateOrder).toHaveBeenCalledWith('ES-1', { status: 'cancelled' }))
    expect(screen.queryByRole('button', { name: 'Review refund' })).toBeNull()
  })
})
