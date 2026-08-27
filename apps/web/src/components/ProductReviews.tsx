import { useEffect, useState } from 'react'
import { api, ApiClientError, type ReviewView } from '../lib/api'
import { formatDate } from '../lib/dates'
import { useAuth } from './AuthContext'
import { useUi } from './UiContext'

interface ProductReviewsProps {
  productSlug: string
  /** Published reviews, newest first. */
  reviews: ReviewView[]
  rating: { average: number; count: number }
  /** Called with the submitted review once the server has stored it. */
  onAdded: (entry: ReviewView) => void
}

/** Customer reviews section: headline, write-a-review form, and the review grid. */
export default function ProductReviews({ productSlug, reviews, rating, onAdded }: ProductReviewsProps) {
  const { user } = useAuth()
  const { openLogin } = useUi()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [form, setForm] = useState({ author: '', rating: 5, text: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // Reset when navigating between products (same component instance).
  useEffect(() => {
    setReviewOpen(false)
    setForm({ author: '', rating: 5, text: '' })
    setError(null)
    setSubmitted(false)
  }, [productSlug])

  /*
   * The author name and the "verified purchase" flag both come from the
   * account server-side — neither is sent from here, because neither can be
   * trusted from a browser.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.text.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const { review } = await api.reviews.create(productSlug, {
        rating: form.rating,
        text: form.text.trim(),
      })
      setForm({ author: '', rating: 5, text: '' })
      setReviewOpen(false)
      setSubmitted(true)
      onAdded(review)
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'We could not save that just now. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Customer Reviews</span>
          <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">
            {rating.count > 0 ? `${rating.average} / 5 from ${rating.count} reviews` : 'Reviews'}
          </h2>
        </div>
        <button
          onClick={() => (user ? setReviewOpen((o) => !o) : openLogin())}
          className="self-start md:self-auto border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-white text-[#1b261b] text-[11px] font-bold tracking-widest uppercase py-3 px-6 rounded-lg transition-all cursor-pointer"
        >
          {!user ? 'Sign in to Review' : reviewOpen ? 'Cancel' : 'Write a Review'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700 mb-4">
          {error}
        </p>
      )}

      {submitted && (
        <div className="bg-[#4a7333]/8 border border-[#4a7333]/25 rounded-xl p-4 mb-6 text-xs text-[#45523f]">
          Thank you — your review has been received and will appear once we have read it.
        </div>
      )}

      {reviewOpen && user && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rv-name" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Your name</label>
              <input
                id="rv-name"
                type="text"
                required
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors"
              />
            </div>
            <div>
              <span className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Rating</span>
              <div className="flex gap-1 items-center h-[46px]" role="radiogroup" aria-label="Rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    onClick={() => setForm((f) => ({ ...f, rating: n }))}
                    className="cursor-pointer"
                  >
                    <svg className="w-6 h-6" viewBox="0 0 20 20" fill={n <= form.rating ? '#8bb56e' : 'none'} stroke="#8bb56e" strokeWidth="1.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label htmlFor="rv-text" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Your review</label>
            <textarea
              id="rv-text"
              required
              rows={4}
              value={form.text}
              onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
              placeholder="How does it taste? How did you brew it?"
              className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:border-[#8bb56e] transition-colors resize-none placeholder:text-[#1b261b]/25"
            />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[11px] font-mono text-[#4a584a]">
              Demo store: reviews are saved in this browser. "Verified purchase" appears only if you've ordered this tea here.
            </p>
            <button
              type="submit"
              className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors cursor-pointer"
            >
              Submit Review
            </button>
          </div>
        </form>
      )}

      {reviews.length === 0 ? (
        <p className="text-sm text-[#4a584a] bg-white border border-[#1b261b]/10 rounded-2xl p-6">
          No reviews yet for this tea. Be the first to tell us how it tastes.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-0.5 text-[#4a7333] text-xs">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5" viewBox="0 0 20 20" fill={i < review.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                    </svg>
                  ))}
                </div>
                <span className="text-[11px] font-mono text-[#4a584a]">{review.publishedAt ? formatDate(review.publishedAt) : ""}</span>
              </div>
              <p className="text-xs text-[#4a584a] leading-relaxed mb-4">{review.text}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">{review.author}</span>
                {review.verified && (
                  <span className="text-[11px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#4a7333] px-2 py-0.5 rounded-full">Verified</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
