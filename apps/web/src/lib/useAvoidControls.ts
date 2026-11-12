import { useEffect, useState, type RefObject } from 'react'

const CONTROL = 'a[href], button, input, select, textarea, label, [role="button"], [tabindex]:not([tabindex="-1"])'

/**
 * For a fixed, floating element (like the Taste Matcher pill): true while a
 * link, button or form field of the page sits underneath it. The caller fades
 * the element out then, so it never covers something a visitor needs to tap.
 *
 * Checks on scroll and resize, at most once per frame, by sampling points
 * across the element's box and asking the browser what lies beneath it.
 */
export function useAvoidControls(ref: RefObject<HTMLElement | null>, enabled = true): boolean {
  const [covering, setCovering] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let frame = 0

    const check = () => {
      frame = 0
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      const xs = [r.left + 4, r.left + r.width / 2, r.right - 4]
      const ys = [r.top + 4, r.top + r.height / 2, r.bottom - 4]
      const hit = xs.some((x) =>
        ys.some((y) =>
          document
            .elementsFromPoint(x, y)
            .some((under) => !el.contains(under) && under.closest(CONTROL) !== null && !el.contains(under.closest(CONTROL))),
        ),
      )
      setCovering(hit)
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check)
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ref, enabled])

  return enabled && covering
}
