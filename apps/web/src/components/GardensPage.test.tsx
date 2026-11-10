import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ gardens: { list: vi.fn() } }))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
// Animation only; nothing to test here.
vi.mock('../lib/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('../lib/useMediaQuery', () => ({ useIsMobile: () => false }))

import GardensPage from './GardensPage'
import { forgetLiveGardens } from '../lib/useGardens'

const liveGarden = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  slug: 'live-estate',
  name: 'Live Estate',
  region: 'Test Valley · Darjeeling',
  elevation: '2,000 ft',
  imageSrc: '/origin.webp',
  story: ['Written in the garden editor.'],
  productSlugs: [],
  ...over,
})

beforeEach(() => {
  api.gardens.list.mockReset()
  forgetLiveGardens()
})

describe('GardensPage', () => {
  it('paints from the snapshot, then shows the live gardens', async () => {
    let resolve: (value: unknown) => void = () => {}
    api.gardens.list.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<GardensPage />)
    expect(screen.getByText('Gopaldhara')).toBeTruthy()

    resolve({ gardens: [liveGarden(), liveGarden({ slug: 'empty', name: 'Empty Estate', story: [] })] })
    expect(await screen.findByText('Live Estate')).toBeTruthy()
    expect(screen.queryByText('Gopaldhara')).toBeNull()
    // No story and no teas: nothing to show.
    expect(screen.queryByText('Empty Estate')).toBeNull()
  })

  it('keeps the snapshot when the API is unreachable, and makes no per-pack claim', async () => {
    api.gardens.list.mockRejectedValue(new Error('offline'))
    const { container } = render(<GardensPage />)
    await waitFor(() => expect(api.gardens.list).toHaveBeenCalled())
    expect(screen.getByText('Rohini')).toBeTruthy()
    expect(container.innerHTML).not.toMatch(/every\s+pack/i)
    // Retired grades are gone from the snapshot story.
    expect(container.innerHTML).not.toMatch(/fannings|broken leaf/i)
  })
})
