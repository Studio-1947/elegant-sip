import { useEffect, useRef, createElement } from 'react'
import type { CSSProperties } from 'react'
import gsap from 'gsap'
import { onContentRevealed } from '../lib/contentReveal'

/* ────────────────────────────────────────────────────────────────────────────
 * BlurText (adapted from reactbits.dev)  words/letters blur-fade into place
 * as the element scrolls into view. Same props and keyframes as the original,
 * but tweened with GSAP (already in the bundle) instead of adding `motion`.
 * Site-specific additions:
 *   • `as` / `inline` so it can sit inside an existing heading (e.g. a green
 *     highlight span next to a dark one) without changing the type styles.
 *   • Inside the desktop ScrollExpand (marked with `data-reveal-gate`), the
 *     observer arms only after the pinned content is actually visible
 *     otherwise the animation would play while the section is still hidden.
 * ──────────────────────────────────────────────────────────────────────────── */

type Snapshot = { filter: string; opacity: number; y: number }

interface BlurTextProps {
  text?: string
  /** Delay between each word/letter in ms. */
  delay?: number
  className?: string
  animateBy?: 'words' | 'letters'
  direction?: 'top' | 'bottom'
  threshold?: number
  rootMargin?: string
  animationFrom?: Snapshot
  animationTo?: Snapshot[]
  onAnimationComplete?: () => void
  /** Seconds per keyframe step. */
  stepDuration?: number
  /** Element rendered as the wrapper. Defaults to a paragraph. */
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'div'
  /** Lay the wrapper out inline (inline-flex) so it can flow inside a heading. */
  inline?: boolean
}

export default function BlurText({
  text = '',
  delay = 200,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  onAnimationComplete,
  stepDuration = 0.35,
  as = 'p',
  inline = false,
}: BlurTextProps) {
  const trailingSpace = text.endsWith(' ')
  const elements = animateBy === 'words' ? text.trim().split(' ') : text.split('')
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const from: Snapshot = animationFrom ?? {
      filter: 'blur(10px)',
      opacity: 0,
      y: direction === 'top' ? -50 : 50,
    }
    const steps: Snapshot[] = animationTo ?? [
      { filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 5 : -5 },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ]

    const segments = Array.from(el.children) as HTMLElement[]
    gsap.set(segments, from)

    let tl: gsap.core.Timeline | null = null
    let observer: IntersectionObserver | null = null
    const play = () => {
      tl = gsap.timeline({ onComplete: onAnimationComplete })
      segments.forEach((seg, i) => {
        const at = (i * delay) / 1000
        steps.forEach((step, s) => {
          tl!.to(seg, { ...step, duration: stepDuration, ease: 'none' }, at + s * stepDuration)
        })
      })
    }
    const arm = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            observer?.disconnect()
            play()
          }
        },
        { threshold, rootMargin },
      )
      observer.observe(el)
    }
    // Inside the pinned home content, wait until it is actually on screen.
    const unsubscribe = el.closest('[data-reveal-gate]') ? onContentRevealed(arm) : (arm(), () => { })

    return () => {
      unsubscribe()
      observer?.disconnect()
      tl?.kill()
      gsap.set(segments, { clearProps: 'all' })
    }
    // Snapshot props are compared by identity; callers pass literals or memoised values.
  }, [text, delay, animateBy, direction, threshold, rootMargin, animationFrom, animationTo, onAnimationComplete, stepDuration])

  const style: CSSProperties = { display: inline ? 'inline-flex' : 'flex', flexWrap: 'wrap' }

  const children = elements.map((segment, index) => {
    const isLast = index === elements.length - 1
    return (
      <span key={index} className="inline-block will-change-[transform,filter,opacity]">
        {/* Non-breaking spaces: a plain space at the end of a flex item is collapsed away. */}
        {segment === ' ' ? ' ' : segment}
        {animateBy === 'words' && (!isLast || trailingSpace) && ' '}
      </span>
    )
  })

  return createElement(as, { ref, className, style }, children)
}
