import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { googleListing, googleReviews, type GoogleReview } from '../data/googleReviews'
import { useDialog } from '../lib/useDialog'
import { useIsMobile } from '../lib/useMediaQuery'
import { useScrollReveal } from '../lib/useScrollReveal'
import StarRating from './reviews/StarRating'

/** Reviews shown at first, and added by each "Show more reviews". */
const PAGE = 6

/** How far below the top of the screen the rating card rides (under the site header). */
const FOLLOW_TOP = 112

/**
 * Topics to filter by, as Google groups this listing's reviews. Each counts the
 * reviews whose own words match, so a chip's number is always what it shows.
 */
const TOPICS: { id: string; label: string; matches: (r: GoogleReview) => boolean }[] = [
  { id: 'darjeeling', label: 'Darjeeling tea', matches: (r) => /darjeeling/i.test(r.text ?? '') },
  { id: 'floral', label: 'Floral notes', matches: (r) => /floral/i.test(r.text ?? '') },
  { id: 'fresh', label: 'Freshness', matches: (r) => /fresh/i.test(r.text ?? '') },
  { id: 'budget', label: 'Budget friendly', matches: (r) => /budget|price|cost/i.test(r.text ?? '') },
  { id: 'photos', label: 'With photos', matches: (r) => (r.photos?.length ?? 0) > 0 },
]

/**
 * Reviews from the shop's Google listing, copied word for word into
 * data/googleReviews.ts. Nothing is shown until at least one is there:
 * no invented quotes, ever.
 */
export default function GoogleReviewsSection({ reviews = googleReviews }: { reviews?: GoogleReview[] }) {
  return reviews.length > 0 ? <GoogleReviewsShowcase reviews={reviews} /> : null
}

function GoogleReviewsShowcase({ reviews }: { reviews: GoogleReview[] }) {
  const headerRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *' })
  const [topic, setTopic] = useState<string | null>(null)
  const [shown, setShown] = useState(PAGE)
  const rating = googleListing.rating.toFixed(1)

  const topics = useMemo(
    () => TOPICS.map((t) => ({ ...t, count: reviews.filter(t.matches).length })).filter((t) => t.count > 0),
    [reviews],
  )
  const active = topics.find((t) => t.id === topic)
  const filtered = active ? reviews.filter(active.matches) : reviews
  const visible = filtered.slice(0, shown)

  const choose = (id: string | null) => {
    setTopic(id)
    setShown(PAGE)
  }

  return (
    <section className="px-6 md:px-12 lg:px-16 py-28 max-w-[1400px] mx-auto bg-[#f9faf7]">
      <div ref={headerRef} className="text-center max-w-2xl mx-auto mb-16">
        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Google Reviews</span>
        <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight">
          Rated {rating} on{' '}
          {/* Google's own wordmark (gstatic googlelogo_clr_74x24px.svg), sized so its letters sit on the text's baseline. */}
          <img src="/google-logo.svg" alt="Google" width={74} height={24} className="inline-block h-[0.93em] w-auto align-[-0.23em]" />
        </h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-12 max-w-6xl mx-auto items-start">
        <RatingSummary reviews={reviews} />

        <div className="min-w-0">
          <div role="group" aria-label="Filter reviews by topic" className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6 md:mx-0 md:px-0 md:flex-wrap mb-6">
            <TopicChip label="All" count={reviews.length} pressed={!active} onClick={() => choose(null)} />
            {topics.map((t) => (
              <TopicChip key={t.id} label={t.label} count={t.count} pressed={active?.id === t.id} onClick={() => choose(t.id)} />
            ))}
          </div>

          <ReviewColumns reviews={visible} />

          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-[#4a584a]" aria-live="polite">
              Showing {visible.length} of {filtered.length}
            </p>
            {visible.length < filtered.length && (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE)}
                className="rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333] transition-colors cursor-pointer"
              >
                Show more reviews
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** The big number, the stars, how the ratings spread, and the way to Google. Stays in view beside the reviews on wide screens. */
function RatingSummary({ reviews }: { reviews: GoogleReview[] }) {
  const ref = useFollowWithinParent<HTMLElement>(FOLLOW_TOP)
  const counts = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: reviews.filter((r) => Math.round(r.rating) === stars).length }))
  const most = Math.max(1, ...counts.map((c) => c.count))

  return (
    <aside ref={ref} aria-label="Google rating" className="relative will-change-transform bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
      <div className="flex items-center gap-4">
        <p className="text-6xl md:text-7xl font-bold tracking-tight text-[#1b261b] leading-none">{googleListing.rating.toFixed(1)}</p>
        <div>
          <StarRating rating={googleListing.rating} className="flex gap-1 text-[#4a7333] text-sm mb-1" />
          <p className="text-sm text-[#4a584a]">
            {googleListing.total} Google {googleListing.total === 1 ? 'review' : 'reviews'}
          </p>
        </div>
      </div>

      <dl className="mt-6 space-y-2">
        {counts.map(({ stars, count }) => (
          <div key={stars} className="flex items-center gap-3 text-xs text-[#4a584a]">
            <dt className="w-6 shrink-0 font-mono">
              {stars}★<span className="sr-only"> stars</span>
            </dt>
            <dd className="flex-1 m-0">
              <span aria-hidden="true" className="block h-2 rounded-full bg-[#1b261b]/[0.06] overflow-hidden">
                <span className="block h-full rounded-full bg-[#4a7333]" style={{ width: `${(count / most) * 100}%` }} />
              </span>
            </dd>
            <dd className="w-6 shrink-0 m-0 text-right font-mono">{count}</dd>
          </div>
        ))}
      </dl>

      <a
        href={googleListing.url}
        target="_blank"
        rel="noreferrer"
        className="mt-6 flex items-center justify-center gap-2 rounded-full border border-[#1b261b]/20 px-5 py-3 text-sm font-semibold text-[#1b261b] hover:border-[#4a7333] hover:text-[#4a7333] transition-colors"
      >
        {/* Google's own "G" (gstatic). */}
        <img src="/google-g.svg" alt="" width={16} height={16} className="w-4 h-4" />
        See us on Google Maps
        <span aria-hidden="true">↗</span>
      </a>
    </aside>
  )
}

/**
 * Keeps an element in view while its parent scrolls past, from the parent's
 * top to its bottom, in both directions; on wide screens only (where the card
 * sits beside the reviews).
 *
 * Not CSS position: sticky. The homepage's content sits inside the hero's
 * ScrollTrigger pin, which, once the pin ends, shifts that content down with
 * a transform. Sticky positions from the unshifted layout, so the card stuck
 * at the bottom of its range. Measuring on screen includes the shift.
 */
function useFollowWithinParent<T extends HTMLElement>(top: number) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent || typeof window.matchMedia !== 'function') return
    const wide = window.matchMedia('(min-width: 1024px)')
    let frame = 0

    const place = () => {
      frame = 0
      if (!wide.matches) {
        el.style.transform = ''
        return
      }
      const room = parent.offsetHeight - el.offsetHeight
      const offset = Math.max(0, Math.min(room, top - parent.getBoundingClientRect().top))
      el.style.transform = offset > 0 ? `translateY(${Math.round(offset)}px)` : ''
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place)
    }

    place()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    wide.addEventListener('change', schedule)
    // "Show more reviews" and "Read more" change how far it can travel.
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule)
    ro?.observe(parent)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      wide.removeEventListener('change', schedule)
      ro?.disconnect()
      el.style.transform = ''
    }
  }, [top])

  return ref
}

function TopicChip({ label, count, pressed, onClick }: { label: string; count: number; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
        pressed ? 'bg-[#1b261b] text-white' : 'bg-white border border-[#1b261b]/10 text-[#1b261b] hover:border-[#4a7333]'
      }`}
    >
      {label} <span className={pressed ? 'text-white/60' : 'text-[#4a584a]'}>{count}</span>
    </button>
  )
}

/**
 * Two columns on wider screens, filled left, right, left… so reading order
 * stays Google's; one column on phones. Each card is as tall as its review.
 */
function ReviewColumns({ reviews }: { reviews: GoogleReview[] }) {
  const isMobile = useIsMobile()
  const columns = isMobile ? [reviews] : [reviews.filter((_, i) => i % 2 === 0), reviews.filter((_, i) => i % 2 === 1)]
  return (
    <div className={`grid gap-4 items-start ${isMobile ? '' : 'grid-cols-2'}`}>
      {columns.map((column, i) => (
        <ul key={i} className="list-none m-0 p-0 flex flex-col gap-4">
          {column.map((r) => (
            <li key={r.id}>
              <ReviewCard review={r} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  )
}

function ReviewCard({ review: r }: { review: GoogleReview }) {
  const [viewing, setViewing] = useState<number | null>(null)

  // A plain click opens the photo over the page; Cmd/Ctrl/Shift-click still opens a tab.
  const openPhoto = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    setViewing(index)
  }

  return (
    <figure className="m-0 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-7">
      <figcaption className="flex items-center gap-3">
        <Avatar review={r} />
        <div className="min-w-0">
          <p className="m-0 text-sm font-bold text-[#1b261b] truncate">{r.author}</p>
          <p className="m-0 text-xs text-[#4a584a]">{r.when} on Google</p>
        </div>
      </figcaption>
      <StarRating rating={r.rating} className="flex gap-1 text-[#4a7333] text-sm mt-4" />
      {r.text && <ReviewText text={r.text} />}
      {r.photos && r.photos.length > 0 && (
        <div className="mt-4 flex gap-2 flex-wrap">
          {r.photos.map((photo, i) => (
            <a
              key={photo.full}
              href={photo.full}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg overflow-hidden"
              aria-label={`Open photo ${i + 1} from ${r.author}'s review`}
              onClick={(e) => openPhoto(e, i)}
            >
              <img src={photo.thumb} alt="" width={64} height={64} loading="lazy" className="w-16 h-16 object-cover bg-[#8bb56e]/15 transition-transform duration-300 hover:scale-105" />
            </a>
          ))}
        </div>
      )}
      {viewing !== null && r.photos && (
        <PhotoViewer review={r} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} />
      )}
    </figure>
  )
}

/**
 * A reviewer's photo, large, over the page: ✕, Escape or a click outside
 * closes it; arrows (and the arrow keys) step through that review's photos.
 * Drawn on <body>: the homepage's content sits inside a transformed container,
 * which would otherwise trap a fixed layer inside it.
 */
function PhotoViewer({
  review: r,
  index,
  onIndex,
  onClose,
}: {
  review: GoogleReview
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  // Focus trap, focus restoration, Escape and scroll lock.
  const dialogRef = useDialog(true, onClose)
  const photos = r.photos ?? []
  const many = photos.length > 1
  const step = (delta: number) => onIndex((index + delta + photos.length) % photos.length)
  const photo = photos[index]
  if (!photo) return null

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10"
      onKeyDown={(e) => {
        if (!many) return
        if (e.key === 'ArrowLeft') step(-1)
        if (e.key === 'ArrowRight') step(1)
      }}
    >
      <div className="absolute inset-0 bg-[#060b08]/90 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${photos.length} from ${r.author}'s review`} className="relative z-10 flex flex-col items-center max-w-5xl w-full">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo"
          className="absolute -top-2 right-0 md:-top-4 md:-right-4 z-20 w-11 h-11 rounded-full bg-white/90 text-[#1b261b] flex items-center justify-center text-lg font-bold shadow-sm hover:bg-white transition-colors cursor-pointer"
        >
          ✕
        </button>
        <div className="relative w-full flex items-center justify-center">
          <img
            key={photo.full}
            src={photo.full}
            alt={`Photo ${index + 1} from ${r.author}'s review`}
            className="max-h-[80vh] max-w-full w-auto h-auto rounded-xl object-contain shadow-2xl bg-[#1b261b]"
          />
          {many && (
            <>
              <ViewerArrow direction="prev" onClick={() => step(-1)} />
              <ViewerArrow direction="next" onClick={() => step(1)} />
            </>
          )}
        </div>
        <p className="mt-4 text-xs font-mono uppercase tracking-wider text-white/70" aria-live="polite">
          {r.author}
          {many && ` · ${index + 1} of ${photos.length}`}
        </p>
      </div>
    </div>,
    document.body,
  )
}

/** The product gallery's arrows, for the photo viewer. */
function ViewerArrow({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const prev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={prev ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 -translate-y-1/2 ${prev ? 'left-2 md:-left-6' : 'right-2 md:-right-6'} z-10 w-11 h-11 rounded-full bg-white/90 border border-[#1b261b]/10 text-[#1b261b] flex items-center justify-center shadow-sm hover:bg-white transition-colors cursor-pointer`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={prev ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}

function Avatar({ review: r }: { review: GoogleReview }) {
  return r.avatar ? (
    <img src={r.avatar} alt="" width={40} height={40} loading="lazy" className="w-10 h-10 shrink-0 rounded-full object-cover bg-[#8bb56e]/15" />
  ) : (
    <div aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#4a7333] font-bold text-sm">
      {r.author.charAt(0).toUpperCase()}
    </div>
  )
}

/**
 * A review's words, paragraph by paragraph as written, clamped to six lines.
 * When they run longer, "Read more" opens the whole review in place.
 */
function ReviewText({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
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
      <div ref={ref} id={id} className={`mt-4 text-[15px] leading-relaxed text-[#1b261b]/85 space-y-3 ${open ? '' : 'line-clamp-6'}`}>
        {text.split('\n').filter(Boolean).map((paragraph, i) => (
          <p key={i} className="m-0">
            {paragraph}
          </p>
        ))}
      </div>
      {(overflows || open) && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="mt-3 text-sm font-semibold text-[#4a7333] hover:text-[#1b261b] transition-colors cursor-pointer"
        >
          {open ? 'Read less' : 'Read more'}
        </button>
      )}
    </>
  )
}
