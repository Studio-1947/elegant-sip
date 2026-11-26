import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import GoogleReviewsStrip from './GoogleReviewsStrip'

describe('Google reviews strip on product pages', () => {
  it('shows a few written Google reviews, never the star-only ones, and links to Google', () => {
    render(
      <GoogleReviewsStrip
        reviews={[
          { id: 'a', author: 'Asha R.', rating: 5, when: '5 months ago', text: 'Lovely bright cup.' },
          { id: 'b', author: 'Stars Only', rating: 5, when: '9 months ago' },
          ...Array.from({ length: 10 }, (_, i) => ({ id: `r${i}`, author: `Reviewer ${i}`, rating: 5, when: '9 months ago', text: `Text ${i}` })),
        ]}
      />,
    )
    const list = screen.getByRole('list', { name: 'Google reviews' })
    const cards = within(list).getAllByRole('figure')
    expect(cards).toHaveLength(8)
    expect(screen.queryByText('Stars Only')).toBeNull()
    expect(within(cards[0]).getByText('5 months ago on Google')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Google reviews/ }).getAttribute('href')).toContain('google.com')
  })

  it('shows nothing when there are no written reviews', () => {
    const { container } = render(<GoogleReviewsStrip reviews={[]} />)
    expect(container.innerHTML).toBe('')
  })
})
