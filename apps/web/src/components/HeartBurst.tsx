import type { CSSProperties } from 'react'

/** Six dots, alternating leaf green and the brand's amber. */
const DOTS = [0, 60, 120, 180, 240, 300].map((angle, i) => ({ angle, color: i % 2 ? '#b0782e' : '#8bb56e' }))

/**
 * Wishlist celebration: a ring and a burst of dots around the heart's circle.
 * Rendered inside the (positioned) circle element; `pop` changes on every save,
 * which remounts the burst and replays it. `radius` is how far the dots fly
 * from the centre, kept small enough not to be clipped by the image corner.
 */
export default function HeartBurst({ pop, radius }: { pop: number; radius: number }) {
  if (pop === 0) return null
  return (
    <span key={pop} aria-hidden="true" className="pointer-events-none absolute inset-0">
      <span className="heart-ring" />
      {DOTS.map(({ angle, color }) => (
        <span
          key={angle}
          className="heart-dot"
          style={{ background: color, '--heart-a': `${angle}deg`, '--heart-r': `${radius}px` } as CSSProperties}
        />
      ))}
    </span>
  )
}
