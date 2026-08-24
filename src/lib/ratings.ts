/* ────────────────────────────────────────────────────────────────────────────
 * One rating calculation for the whole site.
 *
 * The card, the detail page and the "Top Rated" sort each used to compute this
 * differently — the sort read only the (empty) static REVIEWS, so it was a
 * permanent no-op while the cards showed a merged figure. Everything now goes
 * through here.
 * ──────────────────────────────────────────────────────────────────────────── */

import { getReviews } from '../data/products'
import { getLocalReviews } from './localReviews'

export interface Rating {
  /** Mean rating rounded to one decimal, or 0 when there are no reviews. */
  average: number
  count: number
}

/** Seed reviews plus this device's customer-submitted ones. */
export function getMergedRating(productId: string): Rating {
  const reviews = [...getLocalReviews(productId), ...getReviews(productId)]
  if (reviews.length === 0) return { average: 0, count: 0 }
  const total = reviews.reduce((acc, r) => acc + r.rating, 0)
  return {
    average: Math.round((total / reviews.length) * 10) / 10,
    count: reviews.length,
  }
}
