import { useEffect, useRef, useState } from 'react'
import { TESTIMONIALS } from '../data/products'
import { useScrollReveal } from '../lib/useScrollReveal'
import { useIsMobile } from '../lib/useMediaQuery'

const SLIDE_INTERVAL_MS = 4000
/** How long a touch pauses the slideshow before it resumes. */
const INTERACTION_PAUSE_MS = 8000

export default function TestimonialsSection() {
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
      scrollToIndex((activeRef.current + 1) % TESTIMONIALS.length)
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
  }, [isMobile])

  return (
    <section className="px-6 md:px-12 lg:px-16 py-28 max-w-[1400px] mx-auto bg-[#f9faf7]">
      <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Kind Words</span>
        <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">
          Loved by Tea Drinkers
        </h2>
        <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
          Real words from the people who actually drink what we pack.
        </p>
      </div>

      <div
        ref={gridRef}
        className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 -mx-6 px-6 md:mx-auto md:px-0 md:grid md:grid-cols-2 md:gap-8 max-w-5xl"
      >
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
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
              <blockquote className="text-sm text-[#4a584a] leading-relaxed">"{t.quote}"</blockquote>
            </div>
            <figcaption className="flex items-center gap-3 mt-6">
              <div className="w-10 h-10 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#4a7333] font-bold text-sm">
                {t.name.charAt(0)}
              </div>
              <div>
                <p className="text-xs font-bold">{t.name}</p>
                <p className="text-[11px] font-mono text-[#4a584a] uppercase tracking-wider">{t.location}</p>
              </div>
              <span className="ml-auto text-[11px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#4a7333] px-2 py-1 rounded-full">
                Verified
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {/* Slideshow dots (phones only). The visible dot stays 6px, but each
          button carries a 24px hit area — a 6×6px target fails WCAG 2.5.8 and
          is genuinely hard to hit with a thumb. */}
      <div className="md:hidden flex justify-center mt-4">
        {TESTIMONIALS.map((t, i) => (
          <button
            key={t.name}
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
      </div>
    </section>
  )
}
