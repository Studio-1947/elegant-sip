import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminOutboxMessage } from '../../lib/api'

const adminOpsApi = vi.hoisted(() => ({ emailOutbox: vi.fn(), retryEmail: vi.fn(), audit: vi.fn() }))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), adminOpsApi }))

import EmailOutbox from './EmailOutbox'

const message: AdminOutboxMessage = {
  id: '7e3c6a0e-0000-4000-8000-0000000000b1',
  kind: 'general',
  to: 'asha@example.com',
  subject: 'Your order ES-1001 is confirmed',
  status: 'failed',
  attempts: 6,
  lastError: 'Connection timeout',
  nextAttemptAt: '2026-11-10T08:00:00.000Z',
  createdAt: '2026-11-10T04:00:00.000Z',
  sentAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  adminOpsApi.emailOutbox.mockResolvedValue({ messages: [message] })
})

describe('EmailOutbox', () => {
  it('claims a message was sent only when the retry delivered it', async () => {
    adminOpsApi.retryEmail.mockResolvedValue({ message: { ...message, status: 'sent', attempts: 7, sentAt: '2026-11-10T09:00:00.000Z' } })
    const user = userEvent.setup()
    render(<EmailOutbox />)
    await user.click(await screen.findByRole('button', { name: 'Retry now' }))
    expect(adminOpsApi.retryEmail).toHaveBeenCalledWith(message.id)
    expect((await screen.findByRole('status')).textContent).toContain('Sent “Your order ES-1001 is confirmed”')
    expect(screen.queryByRole('button', { name: 'Retry now' })).toBeNull()
  })

  it('keeps the message listed and says why when the retry is refused', async () => {
    adminOpsApi.retryEmail.mockResolvedValue({ message: { ...message, attempts: 7, lastError: '535 Authentication failed' } })
    const user = userEvent.setup()
    render(<EmailOutbox />)
    await user.click(await screen.findByRole('button', { name: 'Retry now' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Still not sent: 535 Authentication failed')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry now' })).toBeTruthy()
    expect(document.body.textContent).toContain('7 attempts')
  })

  it('says so when nothing is waiting', async () => {
    adminOpsApi.emailOutbox.mockResolvedValue({ messages: [] })
    render(<EmailOutbox />)
    expect(await screen.findByText('Nothing is waiting to be sent.')).toBeTruthy()
  })
})
