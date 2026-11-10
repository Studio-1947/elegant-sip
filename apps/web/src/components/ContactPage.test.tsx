import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const api = vi.hoisted(() => ({ contact: { send: vi.fn() } }))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
vi.mock('../lib/analytics', () => ({ track: vi.fn() }))

import ContactPage from './ContactPage'

async function submit() {
  const user = userEvent.setup()
  render(<ContactPage />)
  await user.type(screen.getByLabelText('Name'), 'Asha Rai')
  await user.type(screen.getByLabelText('Email'), 'asha@example.com')
  await user.type(screen.getByLabelText('Message'), 'Where is my parcel, please?')
  await user.click(screen.getByRole('button', { name: 'Send Message' }))
}

beforeEach(() => vi.clearAllMocks())

describe('ContactPage', () => {
  it('says the message was sent, with its reference, only when it was', async () => {
    api.contact.send.mockResolvedValue({ delivered: true, retrying: false, reference: 'ES-C-7K3P9Q' })
    await submit()
    expect(await screen.findByRole('heading', { name: 'Message sent' })).toBeTruthy()
    expect(screen.getByTestId('contact-reference').textContent).toBe('ES-C-7K3P9Q')
  })

  it('says the message is saved but not sent when the email did not go out', async () => {
    api.contact.send.mockResolvedValue({ delivered: false, retrying: false, reference: 'ES-C-ABCDEF' })
    await submit()
    expect(await screen.findByRole('heading', { name: 'Saved, not sent yet' })).toBeTruthy()
    expect(screen.queryByText(/Message sent/)).toBeNull()
    expect(document.body.textContent).toContain('We saved your message')
    expect(document.body.textContent).not.toContain('keep trying')
    expect(screen.getByTestId('contact-reference').textContent).toBe('ES-C-ABCDEF')
  })

  it('mentions automatic retries only when the API queued one', async () => {
    api.contact.send.mockResolvedValue({ delivered: false, retrying: true, reference: 'ES-C-ABCDEF' })
    await submit()
    await screen.findByRole('heading', { name: 'Saved, not sent yet' })
    expect(document.body.textContent).toContain('it will keep trying automatically')
  })
})
