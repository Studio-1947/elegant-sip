import { useEffect, useId, useRef, useState } from 'react'
import { googleListing, googleReviews, type GoogleReview } from '../data/googleReviews'
import { useScrollReveal } from '../lib/useScrollReveal'
import StarRating from './reviews/StarRating'
import { SlideshowDots, useReviewSlideshow } from './reviews/ReviewSlideshow'

/** Cards on the homepage, first in Google's order; the button leads to the rest. */
const SHOWN = 6

/**
 * Reviews from the shop's Google listing, copied word for word into
 * data/googleReviews.ts. Nothing is shown until at least one is there:
 * no invented quotes, ever.
 */
export default function GoogleReviewsSection({ reviews = googleReviews }: { reviews?: GoogleReview[] }) {
  return reviews.length > 0 ? <GoogleReviewsShowcase reviews={reviews.slice(0, SHOWN)} /> : null
}

function GoogleReviewsShowcase({ reviews }: { reviews: GoogleReview[] }) {
  const headerRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *' })
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.15 })
  const { active, goTo } = useReviewSlideshow(gridRef, reviews.length)
  const rating = googleListing.rating.toFixed(1)

  return (
    <section className="px-6 md:px-12 lg:px-16 py-28 max-w-[1400px] mx-auto bg-[#f9faf7]">
      <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Google Reviews</span>
        <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">
          Rated {rating} on{' '}
          {/* Google's own wordmark (gstatic googlelogo_clr_74x24px.svg), sized so its letters sit on the text's baseline. */}
          <img src="/google-logo.svg" alt="Google" width={74} height={24} className="inline-block h-[0.93em] w-auto align-[-0.23em]" />
        </h2>
        <div className="flex items-center justify-center gap-3 mb-6">
          <StarRating rating={googleListing.rating} className="flex gap-1 text-[#4a7333] text-sm" />
          <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
            {rating} out of 5 from {googleListing.total} {googleListing.total === 1 ? 'review' : 'reviews'}
          </p>
        </div>
        <a
          href={googleListing.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333] transition-colors"
        >
          All reviews on
          {/* Google's own "G" (gstatic), on white so its colours keep their contrast on the dark button. */}
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white">
            <img src="/google-g.svg" alt="Google" width={14} height={14} className="w-3.5 h-3.5" />
          </span>
        </a>
      </div>

      <div
        ref={gridRef}
        className="relative flex overflow-x-auto overflow-y-hidden py-2 -my-2 md:py-0 md:my-0 md:overflow-visible snap-x snap-mandatory no-scrollbar gap-4 -mx-6 px-6 md:mx-auto md:px-0 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-8 max-w-6xl"
      >
        {reviews.map((r) => (
          <figure
            key={r.id}
            className="min-w-[82vw] sm:min-w-[46vw] md:min-w-0 snap-center bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 flex flex-col justify-between min-h-[220px] transition-shadow hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)]"
          >
            <div>
              <StarRating rating={r.rating} />
              <ReviewText text={r.text} />
              {r.photos && r.photos.length > 0 && (
                <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
                  {r.photos.map((src) => (
                    <img
                      key={src}
                      src={src}
                      alt={`Photo from ${r.author}'s review`}
                      width={80}
                      height={80}
                      loading="lazy"
                      className="w-20 h-20 shrink-0 rounded-lg object-cover bg-[#8bb56e]/15"
                    />
                  ))}
                </div>
              )}
            </div>
            <figcaption className="flex items-center gap-3 mt-6">
              {r.avatar ? (
                <img src={r.avatar} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 shrink-0 rounded-full object-cover bg-[#8bb56e]/15" />
              ) : (
                <div aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#4a7333] font-bold text-sm">
                  {r.author.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{r.author}</p>
                <p className="text-[11px] font-mono text-[#4a584a] uppercase tracking-wider truncate">{r.when}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      <SlideshowDots ids={reviews.map((r) => r.id)} active={active} onSelect={goTo} />

      <p className="mt-8 text-center text-[11px] font-mono uppercase tracking-wider text-[#4a584a]">Reviews from Google</p>
    </section>
  )
}

/**
 * A review's words, clamped to six lines like the other review cards. When
 * they run longer, "Read more" opens the whole review in place.
 */
function ReviewText({ text }: { text: string }) {
  const ref = useRef<HTMLQuoteElement>(null)
  const id = useId()
  const [open, setOpen] = useState(false)
  const [overflows, setOverflows] = useState(false)

  // Measured while clamped, and again whenever the card changes width.
  useEffect(() => {
    const el = ref.current
    if (!el || open) return
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [open, text])

  return (
    <>
      <blockquote
        ref={ref}
        id={id}
        className={`text-sm text-[#4a584a] leading-relaxed whitespace-pre-line ${open ? '' : 'line-clamp-6'}`}
      >
        "{text}"
      </blockquote>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="mt-3 inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-[#4a7333] border-b-2 border-[#8bb56e]/50 pb-1 cursor-pointer transition-colors hover:text-[#1b261b] hover:border-[#4a7333]"
        >
          {open ? 'Read less' : 'Read more'}
        </button>
      )}
    </>
  )
}
