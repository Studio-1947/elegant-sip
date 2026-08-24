import { useEffect, useRef, ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { markContentRevealed } from '../lib/contentReveal'

gsap.registerPlugin(ScrollTrigger)

interface ScrollExpandProps {
  /** Path to the image (public folder) */
  src: string
  /** Alt text for the image */
  alt?: string
  /** Title overlaid on the image frame */
  title?: string
  /** Scroll hint label shown below the frame */
  scrollHint?: string
  /** If true, progress is tracked via window scroll instead of a wrapper ref */
  useWindowScroll?: boolean
  /** Additional zoom scale applied to the media on expand (default 1.0) */
  mediaZoom?: number
  /** Fixed height override for the outer wrapper (e.g. "520px") — overrides full-screen mode */
  height?: string
  /** Children rendered beneath the expanded image */
  children?: ReactNode
}

/**
 * ScrollExpand
 *
 * Starts as a rounded card. As the user scrolls through the section,
 * the card expands — border-radius collapses, scale grows — until
 * the image fills the entire viewport. After full expansion, the
 * children content is revealed with a fade-up.
 */
export default function ScrollExpand({
  src,
  alt = '',
  title,
  mediaZoom = 1,
  height,
  children,
}: ScrollExpandProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const hintRef = useRef<HTMLDivElement>(null)
  const childrenRef = useRef<HTMLDivElement>(null)

  const isFixed = Boolean(height)

  useEffect(() => {
    const section = sectionRef.current
    const frame = frameRef.current
    const img = imgRef.current
    const titleEl = titleRef.current
    const hintEl = hintRef.current
    const childrenEl = childrenRef.current

    if (!section || !frame) return

    const ctx = gsap.context(() => {
      // ── Frame Expand Timeline ──────────────────────────────────────────
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: isFixed ? 'bottom bottom' : '+=150%',
          scrub: 1.2,
          pin: !isFixed,
          anticipatePin: 1,
          // Let child section reveals know the content is actually on screen.
          // Threshold on timeline progress — reading computed styles here would
          // force a style recalc on every scroll frame. 0.75 matches the point
          // where the children tween passes ~50% opacity; markContentRevealed
          // latches after the first call.
          onUpdate: (self) => {
            if (childrenEl && self.progress >= 0.75) {
              markContentRevealed()
            }
          },
        },
      })

      // 1. Expand the rounded frame to full viewport
      tl.fromTo(
        frame,
        {
          borderRadius: '24px',
          width: '72vw',
          height: '56vh',
          x: 0,
          y: 0,
        },
        {
          borderRadius: '0px',
          width: '100vw',
          height: '100vh',
          x: 0,
          y: 0,
          ease: 'none',
          duration: 1,
        },
        0,
      )

      // 2. Zoom the underlying image slightly for a cinematic feel
      if (img) {
        tl.fromTo(
          img,
          { scale: mediaZoom },
          { scale: mediaZoom * 1.08, ease: 'none', duration: 1 },
          0,
        )
      }

      // 3. Fade out title & scroll hint as expansion begins
      if (titleEl) {
        tl.fromTo(titleEl, { opacity: 1, y: 0 }, { opacity: 0, y: -24, ease: 'none', duration: 0.3 }, 0)
      }
      if (hintEl) {
        tl.fromTo(hintEl, { opacity: 1 }, { opacity: 0, ease: 'none', duration: 0.25 }, 0)
      }

      // 4. Reveal children below after the expansion phase
      if (childrenEl) {
        tl.fromTo(
          childrenEl,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, ease: 'power2.out', duration: 0.5 },
          0.85,
        )
      }
    }, section)

    return () => ctx.revert()
  }, [isFixed, mediaZoom])

  return (
    <div
      ref={sectionRef}
      className="relative w-full"
      style={isFixed ? { height } : { minHeight: '300vh' }}
    >
      {/* Sticky anchor so the frame stays centred during the pin */}
      <div
        className={`${isFixed ? 'relative' : 'sticky top-0'} w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-white`}
      >
        {/* ── Expanding Media Frame ── */}
        <div
          ref={frameRef}
          className="relative overflow-hidden"
          style={{
            width: '72vw',
            height: '56vh',
            borderRadius: '24px',
          }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ scale: mediaZoom, transformOrigin: 'center center' }}
            loading="eager"
            decoding="async"
          />

          {/* Subtle vignette overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

          {/* ── Title overlay ── */}
          {title && (
            <div
              ref={titleRef}
              className="absolute bottom-8 left-8 right-8"
            >
              <p className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase mb-2">
                Elegant Sip
              </p>
              {/* The desktop home's real <h1>. It scrolls away with the hero,
                  but the document must still have exactly one top-level
                  heading — the mobile home has always had one. */}
              <h1 className="text-white text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05]">
                {title}
              </h1>
            </div>
          )}
        </div>

        {/* ── Scroll Hint ── */}
        {!isFixed && (
          <div
            ref={hintRef}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-white/70 text-[11px] font-mono tracking-[0.3em] uppercase">
              Scroll
            </span>
            <div className="w-[1px] h-8 bg-gradient-to-b from-white/30 to-transparent animate-pulse" />
          </div>
        )}
      </div>

      {/* ── Children Content (revealed after expansion) ── */}
      {children && (
        <div
          ref={childrenRef}
          data-reveal-gate
          className="relative z-10 opacity-0"
          style={{ marginTop: isFixed ? 0 : '-100vh' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
