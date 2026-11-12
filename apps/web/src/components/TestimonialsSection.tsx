import { useEffect, useRef, useState } from 'react'
import { api, type ReviewView } from '../lib/api'
import { Link } from '../lib/router'
import { useScrollReveal } from '../lib/useScrollReveal'
import { useIsMobile } from '../lib/useMediaQuery'

type RecentReview = ReviewView & { productSlug: string; productName: string }

const SLIDE_INTERVAL_MS = 4000
/** How long a touch pauses the slideshow before it resumes. */
const INTERACTION_PAUSE_MS = 8000

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
  const isMobile = useIsMobile()
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const pauseUntil = useRef(0)
  const inView = useRef(true)

  const scrollToIndex = (index: number) => {
    const track = gridRef.current
    if (!track) return
    const cards = Array.from(track.children) as HTMLElement[]
    if (!cards[index]) return
    track.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' })
  }

  // Auto-playing slideshow on phones: advance while visible, pause on touch.
  useEffect(() => {
    const track = gridRef.current
    if (!track || !isMobile) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const io = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting
      },
      { threshold: 0.3 },
    )
    io.observe(track)

    const onScroll = () => {
      const cards = Array.from(track.children) as HTMLElement[]
      if (cards.length < 2) return
      const step = cards[1].offsetLeft - cards[0].offsetLeft
      const index = Math.max(0, Math.min(cards.length - 1, Math.round(track.scrollLeft / step)))
      activeRef.current = index
      setActive(index)
    }
    const onInteract = () => {
      pauseUntil.current = Date.now() + INTERACTION_PAUSE_MS
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener('touchstart', onInteract, { passive: true })
    track.addEventListener('pointerdown', onInteract)
    track.addEventListener('wheel', onInteract, { passive: true })

    const timer = window.setInterval(() => {
      if (!inView.current || Date.now() < pauseUntil.current) return
      scrollToIndex((activeRef.current + 1) % reviews.length)
    }, SLIDE_INTERVAL_MS)

    return () => {
      io.disconnect()
      window.clearInterval(timer)
      track.removeEventListener('scroll', onScroll)
      track.removeEventListener('touchstart', onInteract)
      track.removeEventListener('pointerdown', onInteract)
      track.removeEventListener('wheel', onInteract)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile, reviews.length])

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
              <div role="img" className="flex gap-1 text-[#4a7333] text-sm mb-4" aria-label={`Rated ${t.rating} out of 5 stars`}>
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={i < t.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                  </svg>
                ))}
              </div>
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

      {/* Slideshow dots (phones only). The visible dot stays 6px, but each
          button carries a 24px hit area — a 6×6px target fails WCAG 2.5.8 and
          is genuinely hard to hit with a thumb. */}
      {reviews.length > 1 && <div className="md:hidden flex justify-center mt-4">
        {reviews.map((t, i) => (
          <button
            key={t.id}
            onClick={() => {
              pauseUntil.current = Date.now() + INTERACTION_PAUSE_MS
              scrollToIndex(i)
            }}
            aria-label={`Go to review ${i + 1}`}
            aria-current={i === active}
            className="w-8 h-11 flex items-center justify-center cursor-pointer"
          >
            <span
              aria-hidden="true"
              className={`h-1.5 rounded-full block transition-all duration-300 ${
                i === active ? 'w-6 bg-[#4a7333]' : 'w-1.5 bg-[#1b261b]/25'
              }`}
            />
          </button>
        ))}
      </div>}
    </section>
  )
}
