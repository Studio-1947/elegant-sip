import { useEffect, useRef, useState, type RefObject } from 'react'
import { useIsMobile } from '../../lib/useMediaQuery'

const SLIDE_INTERVAL_MS = 4000
/** How long a touch pauses the slideshow before it resumes. */
const INTERACTION_PAUSE_MS = 8000

/**
 * Phones only: the review cards in `trackRef` scroll sideways and advance by
 * themselves while visible, pausing for a while after any touch.
 */
export function useReviewSlideshow(trackRef: RefObject<HTMLElement | null>, count: number) {
  const isMobile = useIsMobile()
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  const pauseUntil = useRef(0)
  const inView = useRef(true)

  const scrollToIndex = (index: number) => {
    const track = trackRef.current
    if (!track) return
    const cards = Array.from(track.children) as HTMLElement[]
    if (!cards[index]) return
    track.scrollTo({ left: cards[index].offsetLeft - cards[0].offsetLeft, behavior: 'smooth' })
  }

  useEffect(() => {
    const track = trackRef.current
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
      scrollToIndex((activeRef.current + 1) % count)
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
  }, [isMobile, count])

  /** A dot was pressed: go there, and hold still for a while. */
  const goTo = (index: number) => {
    pauseUntil.current = Date.now() + INTERACTION_PAUSE_MS
    scrollToIndex(index)
  }

  return { active, goTo }
}

/**
 * Slideshow dots (phones only). The visible dot stays 6px, but each button
 * carries a 24px hit area — a 6×6px target fails WCAG 2.5.8 and is genuinely
 * hard to hit with a thumb.
 */
export function SlideshowDots({ ids, active, onSelect }: { ids: string[]; active: number; onSelect: (index: number) => void }) {
  if (ids.length < 2) return null
  return (
    <div className="md:hidden flex justify-center mt-4">
      {ids.map((id, i) => (
        <button
          key={id}
          onClick={() => onSelect(i)}
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
  )
}
