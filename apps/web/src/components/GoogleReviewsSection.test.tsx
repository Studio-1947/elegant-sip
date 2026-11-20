import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// Animation only; nothing to test here.
vi.mock('../lib/useScrollReveal', () => ({ useScrollReveal: () => ({ current: null }) }))
// Wide screen: two columns.
vi.mock('../lib/useMediaQuery', () => ({ useIsMobile: () => false }))

import GoogleReviewsSection from './GoogleReviewsSection'
import type { GoogleReview } from '../data/googleReviews'

const asha: GoogleReview = {
  id: 'a',
  author: 'Asha R.',
  rating: 5,
  when: '5 months ago',
  text: 'Lovely bright Darjeeling cup, so fresh.\nWill buy again.',
  avatar: '/reviews/a-avatar.webp',
  photos: [{ thumb: '/reviews/a-1-thumb.webp', full: '/reviews/a-1.webp' }],
}
const ben: GoogleReview = { id: 'b', author: 'Ben K.', rating: 4, when: '1 year ago', text: 'Good price.' }
const cara: GoogleReview = { id: 'c', author: 'Cara M.', rating: 5, when: '9 months ago' }

/** Each card's reviewer, in the order shown. */
const authorOf = (f: HTMLElement) => f.querySelector('figcaption p')?.textContent
const names = () => screen.getAllByRole('figure').map(authorOf)

describe('GoogleReviewsSection', () => {
  it('shows nothing while no review has been copied in', () => {
    const { container } = render(<GoogleReviewsSection reviews={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows each review with its reviewer, date, stars, paragraphs and photos', () => {
    render(<GoogleReviewsSection reviews={[asha, ben, cara]} />)
    const card = within(screen.getAllByRole('figure')[0])
    expect(card.getByText('Asha R.')).toBeTruthy()
    expect(card.getByText('5 months ago on Google')).toBeTruthy()
    // The reviewer's own line breaks become paragraphs.
    expect(card.getByText('Lovely bright Darjeeling cup, so fresh.')).toBeTruthy()
    expect(card.getByText('Will buy again.')).toBeTruthy()
    const photo = card.getByRole('link', { name: "Open photo 1 from Asha R.'s review" })
    expect(photo.getAttribute('href')).toBe('/reviews/a-1.webp')
    // A star-only rating is a card with its stars.
    const caraCard = screen.getAllByRole('figure').find((f) => authorOf(f) === 'Cara M.')!
    expect(within(caraCard).getByLabelText('Rated 5 out of 5 stars')).toBeTruthy()
  })

  it('sums up the rating, how it spreads, and links to Google Maps', () => {
    render(<GoogleReviewsSection reviews={[asha, ben, cara]} />)
    const summary = within(screen.getByRole('complementary', { name: 'Google rating' }))
    expect(summary.getByText('22 Google reviews')).toBeTruthy()
    // Counted from the reviews given: two 5s and one 4.
    const counts = summary.getAllByRole('definition').filter((d) => /^\d+$/.test(d.textContent ?? '')).map((d) => d.textContent)
    expect(counts).toEqual(['2', '1', '0', '0', '0'])
    expect(summary.getByRole('link', { name: /See us on Google Maps/ }).getAttribute('href')).toContain('google.com')
  })

  it('fills two columns left, right, left, so reading order stays Google’s', () => {
    const { container } = render(<GoogleReviewsSection reviews={[asha, ben, cara]} />)
    const columns = container.querySelectorAll<HTMLElement>('ul')
    expect(columns).toHaveLength(2)
    expect(within(columns[0]).getAllByRole('figure').map(authorOf)).toEqual(['Asha R.', 'Cara M.'])
    expect(within(columns[1]).getAllByRole('figure').map(authorOf)).toEqual(['Ben K.'])
  })

  it('filters by topic, counting only the reviews whose words match', () => {
    render(<GoogleReviewsSection reviews={[asha, ben, cara]} />)
    expect(screen.getByRole('button', { name: 'All 3' }).getAttribute('aria-pressed')).toBe('true')
    // Topics no review mentions are left out.
    expect(screen.queryByRole('button', { name: /Floral notes/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Budget friendly 1' }))
    expect(names()).toEqual(['Ben K.'])
    fireEvent.click(screen.getByRole('button', { name: 'With photos 1' }))
    expect(names()).toEqual(['Asha R.'])
    fireEvent.click(screen.getByRole('button', { name: 'All 3' }))
    expect(names()).toHaveLength(3)
  })

  it('shows six at first, then six more with each "Show more reviews"', () => {
    const many = Array.from({ length: 14 }, (_, i): GoogleReview => ({ id: `r${i}`, author: `Reviewer ${i}`, rating: 5, when: '9 months ago', text: `Text ${i}` }))
    render(<GoogleReviewsSection reviews={many} />)
    expect(screen.getAllByRole('figure')).toHaveLength(6)
    expect(screen.getByText('Showing 6 of 14')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Show more reviews' }))
    fireEvent.click(screen.getByRole('button', { name: 'Show more reviews' }))
    expect(screen.getAllByRole('figure')).toHaveLength(14)
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull()
  })

  it('has real reviews to show by default', () => {
    render(<GoogleReviewsSection />)
    expect(screen.getByText('Saptarshi Roy Choudhuri')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Rated 5.0 on Google' }).querySelector('img')?.getAttribute('src')).toBe('/google-logo.svg')
    expect(screen.getByText('Showing 6 of 22')).toBeTruthy()
  })

  it('offers "Read more" only on a review longer than its six lines, and opens it in place', () => {
    // jsdom lays nothing out: a long review is one whose text is taller than its box.
    const tall = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent?.includes('long review') ? 400 : 0
    })
    try {
      render(<GoogleReviewsSection reviews={[{ id: 'l', author: 'Long', rating: 5, when: '1 month ago', text: 'A long review' }, ben]} />)
      const more = screen.getAllByRole('button', { name: 'Read more' })
      expect(more).toHaveLength(1)
      fireEvent.click(more[0])
      const less = screen.getByRole('button', { name: 'Read less' })
      expect(less.getAttribute('aria-expanded')).toBe('true')
      expect(document.getElementById(less.getAttribute('aria-controls')!)?.className).not.toContain('line-clamp-6')
    } finally {
      tall.mockRestore()
    }
  })

  it('opens a photo large in the page, steps through the review\'s photos, and closes', () => {
    const two: GoogleReview = {
      id: 'p',
      author: 'Pema T.',
      rating: 5,
      when: '2 months ago',
      text: 'Look at these leaves.',
      photos: [
        { thumb: '/reviews/p-1-thumb.webp', full: '/reviews/p-1.webp' },
        { thumb: '/reviews/p-2-thumb.webp', full: '/reviews/p-2.webp' },
      ],
    }
    render(<GoogleReviewsSection reviews={[two]} />)
    fireEvent.click(screen.getByRole('link', { name: "Open photo 1 from Pema T.'s review" }), { button: 0 })
    const viewer = screen.getByRole('dialog', { name: "Photo 1 of 2 from Pema T.'s review" })
    expect(within(viewer).getByRole('img').getAttribute('src')).toBe('/reviews/p-1.webp')
    fireEvent.click(within(viewer).getByRole('button', { name: 'Next photo' }))
    expect(within(screen.getByRole('dialog')).getByRole('img').getAttribute('src')).toBe('/reviews/p-2.webp')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close photo' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
