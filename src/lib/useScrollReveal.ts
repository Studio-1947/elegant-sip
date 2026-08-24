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
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  options: ScrollRevealOptions = {},
) {
  const ref = useRef<T>(null)
  const [armed, setArmed] = useState(false)
  const { target, y = 36, duration = 0.9, stagger = 0.12 } = options

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
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target
          io.unobserve(el)
          const index = elements.indexOf(el)
          tweens.set(
            el,
            gsap.fromTo(
              el,
              { opacity: 0, y },
              { opacity: 1, y: 0, duration, ease: 'power3.out', delay: index * stagger },
            ),
          )
        }
      },
      { threshold: 0.1 },
    )
    elements.forEach((el) => io.observe(el))

    return () => {
      io.disconnect()
      tweens.forEach((t) => t.kill())
    }
  }, [armed, target, y, duration, stagger])

  return ref
}
