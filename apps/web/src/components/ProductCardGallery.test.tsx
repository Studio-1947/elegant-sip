import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Product } from '../data/products'
import ProductCardGallery from './ProductCardGallery'

// Every card counts as on screen, so its extra photos are fetched.
class SeenObserver {
  constructor(private cb: (entries: { isIntersecting: boolean }[]) => void) {}
  observe() {
    this.cb([{ isIntersecting: true }])
  }
  disconnect() {}
}

const product = (slug: string, photos: number) =>
  ({
    slug,
    name: slug,
    imageSrc: `/products/${slug}.webp`,
    images: Array.from({ length: photos - 1 }, (_, i) => `/products/${slug}-${i + 2}.webp`),
  }) as unknown as Product

/** Which photo each card shows, read from its dots. */
const shown = (card: HTMLElement) => within(card).getAllByRole('button').findIndex((b) => b.getAttribute('aria-current') === 'true')

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('IntersectionObserver', SeenObserver)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('product card photos', () => {
  it('step through their photos together, every card at the same moment', () => {
    render(
      <>
        <div data-testid="a"><ProductCardGallery product={product('first-flush', 3)} /></div>
        <div data-testid="b"><ProductCardGallery product={product('golden-needle', 4)} /></div>
      </>,
    )
    const a = screen.getByTestId('a')
    const b = screen.getByTestId('b')
    expect([shown(a), shown(b)]).toEqual([0, 0])
    act(() => vi.advanceTimersByTime(4000))
    expect([shown(a), shown(b)]).toEqual([1, 1])
    act(() => vi.advanceTimersByTime(4000))
    expect([shown(a), shown(b)]).toEqual([2, 2])
  })

  it('hold a photo the shopper picks, then rejoin the others', () => {
    render(
      <>
        <div data-testid="a"><ProductCardGallery product={product('first-flush', 3)} /></div>
        <div data-testid="b"><ProductCardGallery product={product('golden-needle', 3)} /></div>
      </>,
    )
    const a = screen.getByTestId('a')
    const b = screen.getByTestId('b')
    // The shared rhythm carries on from earlier tests, so compare with where b starts.
    const before = shown(b)
    fireEvent.click(within(a).getByRole('button', { name: 'Show image 3' }))
    act(() => vi.advanceTimersByTime(4000))
    expect(shown(a)).toBe(2)
    expect(shown(b)).toBe((before + 1) % 3)
    act(() => vi.advanceTimersByTime(8000))
    expect(shown(a)).toBe(shown(b))
  })
})
