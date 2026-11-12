import { useEffect, useState } from 'react'
import { ApiClientError, api, type AdminReview, type AdminReviewFilter } from '../../lib/api'
import { formatShortDate } from '../../lib/dates'

const FILTERS: Array<{ value: AdminReviewFilter; label: string }> = [
  { value: 'pending', label: 'Awaiting review' },
  { value: 'published', label: 'Published' },
  { value: 'all', label: 'All reviews' },
]

/**
 * Review moderation. Customer reviews are saved hidden; staff publish them
 * here with PATCH /v1/admin/reviews/{id}.
 */
export default function ReviewQueue() {
  const [filter, setFilter] = useState<AdminReviewFilter>('pending')
  // Tagged with its filter, so a list fetched for another filter is never shown as this one.
  const [list, setList] = useState<{ filter: AdminReviewFilter; reviews: AdminReview[]; hasMore: boolean } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const reviews = list?.filter === filter ? list.reviews : null

  useEffect(() => {
    let cancelled = false
    api.admin
      .listReviews(filter)
      .then((page) => {
        if (!cancelled) setList({ filter, reviews: page.reviews, hasMore: page.hasMore })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'Reviews could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [filter])

  const loadMore = async () => {
    if (!list) return
    const { filter: current, reviews: shown } = list
    setBusy('more')
    setError('')
    try {
      const page = await api.admin.listReviews(current, shown.length)
      setList((existing) => {
        if (existing?.filter !== current) return existing
        // A review published meanwhile can shift the pages; never show one twice.
        const seen = new Set(existing.reviews.map((item) => item.id))
        return { filter: current, reviews: [...existing.reviews, ...page.reviews.filter((item) => !seen.has(item.id))], hasMore: page.hasMore }
      })
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'More reviews could not be loaded.')
    } finally {
      setBusy(null)
    }
  }

  const setPublished = async (review: AdminReview, published: boolean) => {
    setBusy(review.id)
    setError('')
    try {
      await api.admin.setReviewPublished(review.id, published)
      // A review that no longer matches the filter leaves the list, which also keeps "Load more" offsets right.
      setList((existing) => {
        if (!existing) return existing
        const leaves = (existing.filter === 'pending' && published) || (existing.filter === 'published' && !published)
        return {
          ...existing,
          reviews: existing.reviews.flatMap((item) =>
            item.id !== review.id ? [item] : leaves ? [] : [{ ...item, publishedAt: published ? new Date().toISOString() : null }],
          ),
        }
      })
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The review could not be updated.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div><span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Customer voice</span><h2 className="mt-1 text-xl font-bold uppercase tracking-tight">Reviews</h2><p className="mt-1 text-xs text-[#4a584a]">Customer reviews stay hidden from the shop until you publish them.</p></div>
        <label className="text-xs font-mono uppercase tracking-wider text-[#4a584a]">Show
          <select value={filter} onChange={(event) => { setFilter(event.target.value as AdminReviewFilter); setError('') }} className="ml-3 rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-xs text-[#1b261b]">
            {FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white">
        {reviews === null ? <p className="p-6 text-sm text-[#4a584a]">{error ? 'Reviews unavailable.' : 'Loading reviews…'}</p> : reviews.length === 0 ? <p className="p-6 text-sm text-[#4a584a]">{filter === 'pending' ? 'No reviews are waiting.' : 'No reviews here yet.'}</p> : (
          <div className="divide-y divide-[#1b261b]/10">
            {reviews.map((review) => (
              <article key={review.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{review.productName}</span>
                    <span className="font-mono text-xs text-[#4a7333]" aria-label={`${review.rating} out of 5`}>{review.rating}/5</span>
                    {review.verified && <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-green-800">Verified purchase</span>}
                    <span className={`text-[10px] font-mono uppercase tracking-wider ${review.publishedAt ? 'text-[#315b26]' : 'text-amber-700'}`}>{review.publishedAt ? `Published ${formatShortDate(review.publishedAt)}` : 'Hidden'}</span>
                  </div>
                  <p className="mt-2 max-w-2xl whitespace-pre-line wrap-break-word text-sm text-[#4a584a]">{review.body}</p>
                  <p className="mt-1 text-[10px] font-mono text-[#4a584a]">{review.authorName} · written {formatShortDate(review.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {review.publishedAt
                    ? <button onClick={() => void setPublished(review, false)} disabled={busy === review.id} className="rounded-full border border-rose-200 px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 disabled:opacity-50">{busy === review.id ? 'Saving…' : 'Unpublish'}</button>
                    : <button onClick={() => void setPublished(review, true)} disabled={busy === review.id} className="rounded-full bg-[#1b261b] px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-white hover:bg-[#4a7333] disabled:opacity-50">{busy === review.id ? 'Saving…' : 'Publish'}</button>}
                </div>
              </article>
            ))}
          </div>
        )}
        {reviews && list?.hasMore && <div className="border-t border-[#1b261b]/10 p-4 text-center"><button onClick={() => void loadMore()} disabled={busy === 'more'} className="rounded-full border border-[#1b261b]/20 px-5 py-2 text-[10px] font-mono uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">{busy === 'more' ? 'Loading…' : 'Load more'}</button></div>}
      </div>
    </section>
  )
}
