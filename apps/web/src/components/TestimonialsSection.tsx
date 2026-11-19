import { useEffect, useState } from 'react'
import { api, type ReviewView } from '../lib/api'
import { Link } from '../lib/router'
import { useScrollReveal } from '../lib/useScrollReveal'
import StarRating from './reviews/StarRating'
import { SlideshowDots, useReviewSlideshow } from './reviews/ReviewSlideshow'

type RecentReview = ReviewView & { productSlug: string; productName: string }

/**
 * Published customer reviews, newest first at every rating. Nothing is shown
 * until staff have published at least one: no invented quotes, ever.
 */
export default function TestimonialsSection() {
  const [reviews, setReviews] = useState<RecentReview[]>([])

  useEffect(() => {
    let cancelled = false
    api.reviews
      .recent(4)
      .then((data) => !cancelled && setReviews(data.reviews))
      .catch(() => {
        // No reviews section is better than a broken one.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return reviews.length > 0 ? <ReviewsShowcase reviews={reviews} /> : null
}

function ReviewsShowcase({ reviews }: { reviews: RecentReview[] }) {
  const headerRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })
  const { active, goTo } = useReviewSlideshow(gridRef, reviews.length)

  return (
    <section className="px-6 md:px-12 lg:px-16 py-28 max-w-[1400px] mx-auto bg-[#f9faf7]">
      <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Customer Reviews</span>
        <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">
          From People Who Drink It
        </h2>
        <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
          The latest reviews customers have left on our teas, whatever the rating.
        </p>
      </div>

      <div
        ref={gridRef}
        className="relative flex overflow-x-auto overflow-y-hidden py-2 -my-2 md:py-0 md:my-0 md:overflow-visible snap-x snap-mandatory no-scrollbar gap-4 -mx-6 px-6 md:mx-auto md:px-0 md:grid md:grid-cols-2 md:gap-8 max-w-5xl"
      >
        {reviews.map((t) => (
          <figure
            key={t.id}
            className="min-w-[82vw] sm:min-w-[46vw] md:min-w-0 snap-center bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 flex flex-col justify-between min-h-[220px] transition-shadow hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)]"
          >
            <div>
              <StarRating rating={t.rating} />
              <blockquote className="text-sm text-[#4a584a] leading-relaxed line-clamp-6">"{t.text}"</blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-6">
              <div aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#4a7333] font-bold text-sm">
                {t.author.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{t.author}</p>
                <Link to={`/product/${t.productSlug}`} className="block text-[11px] font-mono text-[#4a584a] uppercase tracking-wider truncate hover:text-[#4a7333]">
                  {t.productName}
                </Link>
              </div>
              {/* Only when a paid order from this customer contained the tea; decided by the server. */}
              {t.verified && (
                <span className="ml-auto shrink-0 text-[11px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#4a7333] px-2 py-1 rounded-full">
                  Verified purchase
                </span>
              )}
            </figcaption>
          </figure>
        ))}
      </div>

      <SlideshowDots ids={reviews.map((t) => t.id)} active={active} onSelect={goTo} />
    </section>
  )
}
