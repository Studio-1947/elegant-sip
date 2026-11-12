import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({
  gardens: { adminList: vi.fn(), update: vi.fn(), create: vi.fn(), remove: vi.fn(), list: vi.fn() },
  admin: { products: vi.fn() },
}))
vi.mock('../../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../../lib/api')>()), api }))

import GardenEditor, { parseStory } from './GardenEditor'

const garden = {
  id: crypto.randomUUID(),
  slug: 'gopaldhara',
  name: 'Gopaldhara',
  region: 'Darjeeling',
  elevation: '3,500 ft',
  imageSrc: '/gopal-1024.webp',
  story: ['One.', 'Two.'],
  sortOrder: 0,
  products: [{ slug: 'first-flush-fannings', name: 'Old Fannings', archived: true }],
}

beforeEach(() => {
  Object.values(api.gardens).forEach((fn) => fn.mockReset())
  api.admin.products.mockReset()
  api.gardens.adminList.mockResolvedValue({ gardens: [garden] })
  api.admin.products.mockResolvedValue({ products: [{ slug: 'first-flush', name: 'First Flush' }] })
})

describe('parseStory', () => {
  it('splits on blank lines and joins wrapped lines', () => {
    expect(parseStory('One\nstill one.\n\n\n  Two.  \n\n')).toEqual(['One still one.', 'Two.'])
  })
})

describe('GardenEditor', () => {
  it('saves edited copy and the ticked teas, keeping a retired link visible', async () => {
    api.gardens.update.mockImplementation(async (_slug: string, body: object) => ({ ...garden, ...body }))
    render(<GardenEditor />)
    fireEvent.click(await screen.findByRole('button', { name: /Gopaldhara/ }))

    expect(screen.getByText(/retired — not shown/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(/Story/), { target: { value: 'New first.\n\nNew second.' } })
    fireEvent.click(screen.getByLabelText(/Old Fannings/)) // untick the retired tea
    await waitFor(() => expect(screen.getByLabelText(/First Flush/)).toBeTruthy())
    fireEvent.click(screen.getByLabelText(/First Flush/))
    fireEvent.click(screen.getByRole('button', { name: 'Save garden' }))

    await waitFor(() => expect(api.gardens.update).toHaveBeenCalled())
    expect(api.gardens.update).toHaveBeenCalledWith('gopaldhara', expect.objectContaining({
      story: ['New first.', 'New second.'],
      productSlugs: ['first-flush'],
    }))
    expect(await screen.findByText('Gopaldhara saved.')).toBeTruthy()
  })

  it('refuses an image that is not a .webp path on the site, without calling the API', async () => {
    render(<GardenEditor />)
    fireEvent.click(await screen.findByRole('button', { name: /Gopaldhara/ }))
    fireEvent.change(screen.getByLabelText(/Photo/), { target: { value: 'https://example.com/a.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save garden' }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/\.webp/)
    expect(api.gardens.update).not.toHaveBeenCalled()
  })
})
