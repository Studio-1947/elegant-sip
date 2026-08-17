/* ────────────────────────────────────────────────────────────────────────────
 * Customer-submitted reviews, persisted to this browser's localStorage.
 * The "Verified purchase" flag is granted only when an order on this device
 * actually contains the product (see lib/orders.ts).
 * ──────────────────────────────────────────────────────────────────────────── */

import type { Review } from '../data/products'

const KEY = 'elegant_sip_reviews'

type ReviewStore = Record<string, Review[]>

function load(): ReviewStore {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function getLocalReviews(productId: string): Review[] {
  return load()[productId] ?? []
}

export function addLocalReview(
  productId: string,
  review: { author: string; rating: number; text: string; verified: boolean },
): Review {
  const store = load()
  const entry: Review = {
    id: `local-${productId}-${Date.now()}`,
    author: review.author,
    rating: review.rating,
    text: review.text,
    verified: review.verified,
    date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  }
  store[productId] = [entry, ...(store[productId] ?? [])]
  localStorage.setItem(KEY, JSON.stringify(store))
  return entry
}
