import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ reviews: { recent: vi.fn() } }))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
// Animation only; nothing to test here.
vi.mock('../lib/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('../lib/useMediaQuery', () => ({ useIsMobile: () => false }))

import TestimonialsSection from './TestimonialsSection'

const review = (over: Partial<Record<string, unknown>> = {}) => ({
  id: crypto.randomUUID(),
  author: 'Asha R.',
  rating: 4,
  text: 'Lovely bright cup.',
  publishedAt: '2026-11-09T05:00:00.000Z',
  verified: false,
  productSlug: 'first-flush',
  productName: 'First Flush',
  ...over,
})

beforeEach(() => api.reviews.recent.mockReset())

describe('TestimonialsSection', () => {
  it('shows nothing until a review has been published', async () => {
    api.reviews.recent.mockResolvedValue({ reviews: [] })
    const { container } = render(<TestimonialsSection />)
    await waitFor(() => expect(api.reviews.recent).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('shows published reviews with their tea, and "Verified purchase" only when the server says so', async () => {
    api.reviews.recent.mockResolvedValue({
      reviews: [review({ author: 'Asha R.', verified: true }), review({ author: 'Ben K.', rating: 2, productName: 'Green Tea' })],
    })
    render(<TestimonialsSection />)
    expect(await screen.findByText('Asha R.')).toBeTruthy()
    expect(screen.getByText('Ben K.')).toBeTruthy()
    expect(screen.getByText('Green Tea')).toBeTruthy()
    expect(screen.getByLabelText('Rated 2 out of 5 stars')).toBeTruthy()
    expect(screen.getAllByText('Verified purchase')).toHaveLength(1)
  })
})
