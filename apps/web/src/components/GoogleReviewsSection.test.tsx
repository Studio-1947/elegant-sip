import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// Animation only; nothing to test here.
vi.mock('../lib/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
vi.mock('../lib/useMediaQuery', () => ({ useIsMobile: () => false }))

import GoogleReviewsSection from './GoogleReviewsSection'

describe('GoogleReviewsSection', () => {
  it('shows nothing while no review has been copied in', () => {
    const { container } = render(<GoogleReviewsSection reviews={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows each review with its stars, reviewer, date and photos, and links to the listing', () => {
    render(
      <GoogleReviewsSection
        reviews={[
          { id: 'a', author: 'Asha R.', rating: 5, when: '5 months ago', text: 'Lovely bright cup.', photos: ['/reviews/a-1.webp'] },
          { id: 'b', author: 'Ben K.', rating: 4, when: '1 year ago', text: 'Good.' },
        ]}
      />,
    )
    expect(screen.getByText('Asha R.')).toBeTruthy()
    expect(screen.getByText('5 months ago')).toBeTruthy()
    expect(screen.getByText('"Lovely bright cup."')).toBeTruthy()
    expect(screen.getByLabelText('Rated 4 out of 5 stars')).toBeTruthy()
    expect(screen.getByAltText("Photo from Asha R.'s review").getAttribute('src')).toBe('/reviews/a-1.webp')
    expect(screen.getByRole('link', { name: 'All reviews on Google' }).getAttribute('href')).toContain('google.com/maps')
  })

  it('shows the first six, in the order given', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, author: `Reviewer ${i}`, rating: 5, when: '9 months ago', text: `Text ${i}` }))
    render(<GoogleReviewsSection reviews={many} />)
    expect(screen.getAllByRole('figure').map((f) => f.textContent?.match(/Reviewer \d/)?.[0])).toEqual(['Reviewer 0', 'Reviewer 1', 'Reviewer 2', 'Reviewer 3', 'Reviewer 4', 'Reviewer 5'])
  })

  it('has real reviews to show by default', () => {
    render(<GoogleReviewsSection />)
    expect(screen.getByText('Sonam Sherpa')).toBeTruthy()
    // Google's wordmark stands in for the word, and is read out as it.
    expect(screen.getByRole('heading', { name: 'Rated 5.0 on Google' }).querySelector('img')?.getAttribute('src')).toBe('/google-logo.svg')
    expect(screen.getAllByRole('figure')).toHaveLength(6)
  })

  it('offers "Read more" only on a review longer than its six lines, and opens it in place', () => {
    // jsdom lays nothing out: a long review is one whose text is taller than its box.
    const tall = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes('long review') ? 400 : 0
    })
    try {
      render(
        <GoogleReviewsSection
          reviews={[
            { id: 'a', author: 'Long', rating: 5, when: '1 month ago', text: 'A long review' },
            { id: 'b', author: 'Short', rating: 5, when: '1 month ago', text: 'Short.' },
          ]}
        />,
      )
      const more = screen.getAllByRole('button', { name: 'Read more' })
      expect(more).toHaveLength(1)
      expect(more[0].getAttribute('aria-expanded')).toBe('false')
      fireEvent.click(more[0])
      const less = screen.getByRole('button', { name: 'Read less' })
      expect(less.getAttribute('aria-expanded')).toBe('true')
      expect(document.getElementById(less.getAttribute('aria-controls')!)?.className).not.toContain('line-clamp-6')
    } finally {
      tall.mockRestore()
    }
  })
})
