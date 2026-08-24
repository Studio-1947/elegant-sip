/* ────────────────────────────────────────────────────────────────────────────
 * Customer-submitted reviews, persisted to this browser's localStorage.
 * The "Verified purchase" flag is granted only when an order on this device
 * actually contains the product (see lib/orders.ts).
 * ──────────────────────────────────────────────────────────────────────────── */

import type { Review } from '../data/products'

const KEY = 'elegant_sip_reviews'

type ReviewStore = Record<string, Review[]>

/** Per-product cap — the store is a browser quota, not a database. */
const MAX_REVIEWS_PER_PRODUCT = 50
const MAX_AUTHOR_LENGTH = 60
const MAX_TEXT_LENGTH = 2000

function isReview(value: unknown): value is Review {
  if (!value || typeof value !== 'object') return false
  const r = value as Partial<Review>
  return (
    typeof r.id === 'string' &&
    typeof r.author === 'string' &&
    typeof r.text === 'string' &&
    typeof r.date === 'string' &&
    typeof r.rating === 'number' &&
    r.rating >= 1 &&
    r.rating <= 5
  )
}

function load(): ReviewStore {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) || '{}')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    // localStorage is user-editable: validate every entry rather than trusting
    // that `store[id]` is an array of well-formed reviews.
    const clean: ReviewStore = {}
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue
      const valid = list.filter(isReview).slice(0, MAX_REVIEWS_PER_PRODUCT)
      if (valid.length > 0) clean[id] = valid
    }
    return clean
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
    author: review.author.slice(0, MAX_AUTHOR_LENGTH),
    // Clamp defensively even though the form is a controlled 1–5 select.
    rating: Math.min(5, Math.max(1, Math.round(review.rating))),
    text: review.text.slice(0, MAX_TEXT_LENGTH),
    verified: review.verified,
    date: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  }
  store[productId] = [entry, ...(store[productId] ?? [])].slice(0, MAX_REVIEWS_PER_PRODUCT)
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Quota exceeded or storage disabled (private mode). The review is still
    // returned so the UI can show it for this session — it just won't persist.
  }
  return entry
}
