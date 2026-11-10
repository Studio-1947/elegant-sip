import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SavedAddress } from '../../lib/api'

const api = vi.hoisted(() => ({
  account: { addresses: vi.fn(), deleteAddress: vi.fn(), saveAddress: vi.fn(), updateAddress: vi.fn() },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), api }))

import AddressBookSection from './AddressBookSection'

const home: SavedAddress = {
  id: '7e3c6a0e-0000-4000-8000-0000000000a1',
  label: 'Home',
  name: 'Asha Rai',
  line1: '12 Hill Cart Road',
  city: 'Darjeeling',
  postalCode: '734101',
  state: 'West Bengal',
  country: 'India',
  phone: null,
  isDefaultShipping: true,
  isDefaultBilling: true,
  isDefault: true,
}

beforeEach(() => {
  vi.clearAllMocks()
  api.account.addresses.mockResolvedValue({ addresses: [home] })
  api.account.deleteAddress.mockResolvedValue({ ok: true })
})

describe('address book: removing an address', () => {
  it('asks in the page, not with window.confirm, and keeping the address changes nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(<AddressBookSection />)
    await user.click(await screen.findByRole('button', { name: 'Remove' }))

    const question = screen.getByRole('group', { name: 'Remove “Home” from your address book?' })
    expect(question).toBeTruthy()
    expect(confirm).not.toHaveBeenCalled()
    // The safe choice has focus, so a stray Enter does not delete anything.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Keep it' }))

    await user.click(screen.getByRole('button', { name: 'Keep it' }))
    expect(api.account.deleteAddress).not.toHaveBeenCalled()
    expect(screen.queryByRole('group')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove' }))
  })

  it('closes on Escape without removing', async () => {
    const user = userEvent.setup()
    render(<AddressBookSection />)
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('group')).toBeNull()
    expect(api.account.deleteAddress).not.toHaveBeenCalled()
  })

  it('removes the address once confirmed', async () => {
    const user = userEvent.setup()
    render(<AddressBookSection />)
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    api.account.addresses.mockResolvedValue({ addresses: [] })
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))
    expect(api.account.deleteAddress).toHaveBeenCalledWith(home.id)
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Address removed.'))
    expect(screen.queryByText('Home')).toBeNull()
  })

  it('keeps the question open and shows the reason when removal fails', async () => {
    const { ApiClientError } = await import('../../lib/api')
    api.account.deleteAddress.mockRejectedValue(new ApiClientError(409, 'conflict', 'That address is in use.'))
    const user = userEvent.setup()
    render(<AddressBookSection />)
    await user.click(await screen.findByRole('button', { name: 'Remove' }))
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('That address is in use.'))
    expect(screen.getByRole('group')).toBeTruthy()
  })
})
