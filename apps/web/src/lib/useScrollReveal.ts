import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { onContentRevealed } from './contentReveal'

interface ScrollRevealOptions {
  /** CSS selector for the child elements to stagger; omit to animate the element itself. */
  target?: string
  /** Distance (px) to rise from. */
  y?: number
  /** Duration in seconds. */
  duration?: number
  /** Delay between staggered children when they enter the viewport together. */
  stagger?: number
}

/**
 * Simple scroll-triggered reveal: fades the element (or its matching children,
 * staggered) in as it actually enters the viewport, using GSAP for the tween.
 *
 * Visibility is measured with IntersectionObserver rather than ScrollTrigger so
 * the reveals work correctly inside the homepage's pinned ScrollExpand — during
 * the pin, document scroll advances while the content is fixed in place (and
 * still at opacity 0), which makes scroll-position triggers fire too early.
 * Observers are armed only after the content reveal signal so nothing animates
 * while the pinned content is still hidden.
 *
 * Kept quick (UX audit: sections sat blank while scrolling): reveals start just
 * before an element enters, and the stagger counts only the elements arriving
 * together, so the tenth card on a page never waits a second behind the first.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {},
) {
  const ref = useRef<T>(null)
  const [armed, setArmed] = useState(false)
  const { target, y = 20, duration = 0.6, stagger = 0.08 } = options

  useEffect(() => onContentRevealed(() => setArmed(true)), [])

  useEffect(() => {
    if (!armed) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const scope = ref.current
    if (!scope) return

    const elements = target ? Array.from(scope.querySelectorAll(target)) : [scope]
    if (elements.length === 0) return

    // Hold elements hidden until they actually enter the viewport, so the
    // fade-up starts from a clean state (no visible pop-in before the tween).
    gsap.set(elements, { opacity: 0, y })

    const tweens = new Map<Element, gsap.core.Tween>()
    const io = new IntersectionObserver(
      (entries) => {
        // Stagger only within this batch: elements that entered together.
        let index = 0
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target
          io.unobserve(el)
          tweens.set(
            el,
            gsap.fromTo(
              el,
              { opacity: 0, y },
              { opacity: 1, y: 0, duration, ease: 'power3.out', delay: index * stagger },
            ),
          )
          index += 1
        }
      },
      // Start a little before the element scrolls into view.
      { threshold: 0.01, rootMargin: '0px 0px 15% 0px' },
    )
    elements.forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      tweens.forEach((t) => t.kill())
    }
  }, [armed, target, y, duration, stagger])

  return ref
}
