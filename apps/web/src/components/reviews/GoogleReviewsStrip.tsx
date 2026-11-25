import { useEffect, useRef, useState } from 'react'
import { googleListing, googleReviews, type GoogleReview } from '../../data/googleReviews'
import StarRating from './StarRating'

/** Seconds between slides while the strip is in view. */
const STEP_MS = 5000
/** How long a touch, a wheel or an arrow holds the strip still. */
const PAUSE_MS = 9000
/** Reviews shown: the first ones in Google's order that have words. */
const SHOWN = 8

/**
 * A compact slideshow of the shop's Google reviews, for product pages: one card
 * at a time on phones, three on wide screens. It moves on by itself while in
 * view, holds still on hover, focus or touch, and never moves for visitors who
 * prefer reduced motion. Long reviews are clamped; the full text is on Google.
 */
export default function GoogleReviewsStrip({ reviews = googleReviews }: { reviews?: GoogleReview[] }) {
  const shown = reviews.filter((r) => r.text).slice(0, SHOWN)
  const trackRef = useRef<HTMLUListElement>(null)
  const pauseUntil = useRef(0)
  const [edges, setEdges] = useState({ start: true, end: false })

  const step = (direction: 1 | -1, wrap = false) => {
    const track = trackRef.current
    if (!track) return
    const first = track.children[0] as HTMLElement | undefined
    const second = track.children[1] as HTMLElement | undefined
    const width = first && second ? second.offsetLeft - first.offsetLeft : track.clientWidth
    const end = track.scrollWidth - track.clientWidth
    const atEnd = track.scrollLeft >= end - 2
    const left = wrap && direction === 1 && atEnd ? 0 : Math.max(0, Math.min(end, track.scrollLeft + direction * width))
    track.scrollTo({ left, behavior: 'smooth' })
  }

  const arrow = (direction: 1 | -1) => {
    pauseUntil.current = Date.now() + PAUSE_MS
    step(direction)
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const update = () => {
      const end = track.scrollWidth - track.clientWidth
      setEdges({ start: track.scrollLeft <= 2, end: track.scrollLeft >= end - 2 })
    }
    const hold = () => {
      pauseUntil.current = Date.now() + PAUSE_MS
    }
    update()
    track.addEventListener('scroll', update, { passive: true })
    track.addEventListener('pointerdown', hold)
    track.addEventListener('touchstart', hold, { passive: true })
    track.addEventListener('wheel', hold, { passive: true })
    window.addEventListener('resize', update)

    let inView = false
    let hovering = false
    const enter = () => (hovering = true)
    const leave = () => (hovering = false)
    track.addEventListener('pointerenter', enter)
    track.addEventListener('pointerleave', leave)

    const calm = typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let timer = 0
    let io: IntersectionObserver | undefined
    if (!calm && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.4 })
      io.observe(track)
      timer = window.setInterval(() => {
        const focused = track.contains(document.activeElement)
        if (inView && !hovering && !focused && !document.hidden && Date.now() >= pauseUntil.current) step(1, true)
      }, STEP_MS)
    }

    return () => {
      io?.disconnect()
      window.clearInterval(timer)
      track.removeEventListener('scroll', update)
      track.removeEventListener('pointerdown', hold)
      track.removeEventListener('touchstart', hold)
      track.removeEventListener('wheel', hold)
      track.removeEventListener('pointerenter', enter)
      track.removeEventListener('pointerleave', leave)
      window.removeEventListener('resize', update)
    }
  }, [])

  if (shown.length === 0) return null

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <a
          href={googleListing.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[#4a584a] hover:text-[#4a7333] transition-colors"
        >
          {/* Google's own "G" (gstatic). */}
          <img src="/google-g.svg" alt="" width={16} height={16} className="w-4 h-4" />
          <span>
            <span className="font-bold text-[#1b261b]">{googleListing.rating.toFixed(1)}</span> from {googleListing.total} Google reviews
          </span>
          <span aria-hidden="true">↗</span>
        </a>
        <div className="hidden sm:flex gap-2">
          <StripArrow direction="prev" disabled={edges.start} onClick={() => arrow(-1)} />
          <StripArrow direction="next" disabled={edges.end} onClick={() => arrow(1)} />
        </div>
      </div>

      <ul
        ref={trackRef}
        aria-label="Google reviews"
        className="list-none m-0 p-0 flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-6 px-6 scroll-px-6 md:mx-0 md:px-0 md:scroll-px-0"
      >
        {shown.map((r) => (
          <li key={r.id} className="snap-start shrink-0 w-[85%] sm:w-[calc((100%-1rem)/2)] lg:w-[calc((100%-2rem)/3)]">
            <figure className="m-0 h-full bg-white border border-[#1b261b]/10 rounded-2xl p-5 flex flex-col">
              <StarRating rating={r.rating} className="flex gap-1 text-[#4a7333] text-sm mb-3" />
              <blockquote className="m-0 flex-1 text-sm text-[#4a584a] leading-relaxed line-clamp-4">"{r.text}"</blockquote>
              <figcaption className="flex items-center gap-3 mt-4">
                {r.avatar ? (
                  <img src={r.avatar} alt="" width={32} height={32} loading="lazy" className="w-8 h-8 shrink-0 rounded-full object-cover bg-[#8bb56e]/15" />
                ) : (
                  <span aria-hidden="true" className="w-8 h-8 shrink-0 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#4a7333] font-bold text-xs">
                    {r.author.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block text-xs font-bold text-[#1b261b] truncate">{r.author}</span>
                  <span className="block text-[11px] font-mono text-[#4a584a] uppercase tracking-wider truncate">{r.when} on Google</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StripArrow({ direction, disabled, onClick }: { direction: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const prev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={prev ? 'Previous reviews' : 'Next reviews'}
      className="w-10 h-10 rounded-full border border-[#1b261b]/15 bg-white text-[#1b261b] flex items-center justify-center cursor-pointer transition-colors hover:border-[#4a7333] hover:text-[#4a7333] disabled:opacity-40 disabled:cursor-default disabled:hover:border-[#1b261b]/15 disabled:hover:text-[#1b261b]"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={prev ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}
