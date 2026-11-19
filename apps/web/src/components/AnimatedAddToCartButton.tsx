import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(useGSAP)

/*
 * An "Add to cart" button that pours a cup of tea when pressed: the label
 * fades, a line-art cup and saucer draw themselves, a teapot appears above the
 * button and tips, an amber stream falls through the button's soft top edge,
 * the cup fills and steams, and the label returns.
 *
 * The click handler runs immediately — the animation is decoration and never
 * delays the real action. The whole sequence is one GSAP timeline, so its
 * timings are fixed relative to each other and cannot drift. Only transform,
 * opacity, stroke-dashoffset and the background path's `d` are animated.
 *
 * Layers (bottom to top):
 *   1. <svg> background path: the button shape, whose top edge can ripple.
 *   2. Clip layer (overflow hidden, same corner radii): label, cup, tea, steam.
 *   3. Pour layer (not clipped): the teapot, which sits above the button, and
 *      the stream it pours down through the top edge into the cup.
 * Layers 2 and 3 share one coordinate system ("cup space", 1 unit = 1px),
 * centred on the button, so the stream lands exactly in the cup.
 */

/** Corner radii in px: top-left, top-right, bottom-right, bottom-left. */
export interface CornerRadii {
  tl: number
  tr: number
  br: number
  bl: number
}
// The reference's deliberately asymmetric corners.
const DEFAULT_RADII: CornerRadii = { tl: 16, tr: 4, br: 20, bl: 4 }

const WOBBLE_HALF_WIDTH = 30
const TEA = '#d18b2c' // Darjeeling liquor: the only colour in the component

// ── Cup space ──
const CUP_W = 22
const CUP_H = 20
const CUP_CX = 11
const POUR_X = 11.5 // where the stream lands
// Tea surface when full, and how far below that the tea starts.
const TEA_TOP = 6.5
const TEA_DEPTH = 10

// ── Teapot, drawn in its own box with the body centred on (11, 10.5) ──
const POT_BODY = { x: 11, y: 10.5, ry: 5.5 }
const POT_SPOUT_TIP = { x: 23, y: 5.2 }
const POT_GAP = 3 // px between the teapot and the button's top edge
const TILT = 35 // degrees

const ms = (t: number) => t / 1000

interface Size {
  w: number
  h: number
}

/** The button outline, with a smooth bump in the top edge `dip` px deep (negative swells upward). */
function buttonPath({ w, h }: Size, dip: number, radii: CornerRadii): string {
  const r = {
    tl: Math.min(radii.tl, h / 2),
    tr: Math.min(radii.tr, h / 2),
    br: Math.min(radii.br, h / 2),
    bl: Math.min(radii.bl, h / 2),
  }
  const cx = w / 2
  const half = Math.max(0, Math.min(WOBBLE_HALF_WIDTH, cx - r.tl - 1, w - r.tr - cx - 1))
  const q = half / 2
  return [
    `M${r.tl} 0`,
    `L${cx - half} 0`,
    `C${cx - q} 0 ${cx - q} ${dip} ${cx} ${dip}`,
    `C${cx + q} ${dip} ${cx + q} 0 ${cx + half} 0`,
    `L${w - r.tr} 0`,
    `Q${w} 0 ${w} ${r.tr}`,
    `L${w} ${h - r.br}`,
    `Q${w} ${h} ${w - r.br} ${h}`,
    `L${r.bl} ${h}`,
    `Q0 ${h} 0 ${h - r.bl}`,
    `L0 ${r.tl}`,
    `Q0 0 ${r.tl} 0`,
    'Z',
  ].join(' ')
}

/**
 * Where the teapot sits for a button of height `h`, in cup space: resting just
 * above the top edge, placed so that once tilted its spout is over the cup.
 */
function pourGeometry(h: number) {
  const buttonTop = -(h - CUP_H) / 2
  const a = (TILT * Math.PI) / 180
  const dx = POT_SPOUT_TIP.x - POT_BODY.x
  const dy = POT_SPOUT_TIP.y - POT_BODY.y
  const tipDx = dx * Math.cos(a) - dy * Math.sin(a)
  const tipDy = dx * Math.sin(a) + dy * Math.cos(a)
  const tipX = POUR_X - 2
  const cx = tipX - tipDx
  const cy = buttonTop - POT_GAP - POT_BODY.ry
  const tipY = cy + tipDy
  return {
    buttonTop,
    pot: { cx, cy },
    stream: `M${tipX} ${tipY}Q${POUR_X} ${tipY} ${POUR_X} ${tipY + 4}L${POUR_X} 14`,
  }
}

// Cup strokes in drawing order: body, handle, saucer.
const CUP_STROKES = ['M4 5h14v3.5a7 7 0 0 1-7 7 7 7 0 0 1-7-7Z', 'M18 7.3h1.4a2.6 2.6 0 0 1 0 5.2H17', 'M1.5 17.8q9.5 2.4 19 0']
const CUP_INTERIOR = 'M4.75 5.75h12.5v2.75a6.25 6.25 0 0 1-6.25 6.25 6.25 6.25 0 0 1-6.25-6.25Z'
const STEAM = ['M8.5 3.6c-1.3-1.4 1.3-2.5 0-4.3', 'M13.5 3.6c-1.3-1.4 1.3-2.5 0-4.3']

/** Line-art teapot: filled with the button colour so it reads on a light card and on the button alike. */
function Teapot() {
  const body = { style: { fill: 'var(--atc-bg)' } }
  return (
    <g stroke="#fff" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.3 8Q.6 8 1 11q.4 2.6 3.6 2" fill="none" />
      <path d="M17.5 8.6Q20 8 22.5 4.8l.9.8Q21 10.5 18 12.6Z" {...body} />
      <ellipse cx={POT_BODY.x} cy={POT_BODY.y} rx={7} ry={POT_BODY.ry} {...body} />
      <path d="M7.5 5.6Q11 3 14.5 5.6" fill="none" />
      <circle cx={11} cy={2.6} r={1} {...body} />
    </g>
  )
}

export interface AnimatedAddToCartButtonProps {
  /** Runs immediately on click, before any animation. */
  onClick: () => void
  /** Visible label and accessible name. */
  label?: ReactNode
  /** Label once something has been added, from the second press onwards. */
  repeatLabel?: ReactNode
  /** Label shown briefly instead of the animation when reduced motion is preferred. */
  confirmedLabel?: ReactNode
  /** Polite screen-reader announcement after a click. Pass `null` when something else (e.g. a toast) already announces it. */
  announcement?: string | null
  /** Button sizing/layout. Defaults to the reference 183×54. */
  className?: string
  /** Label typography. */
  labelClassName?: string
  /** Corner radii in px; a single number rounds all four corners equally. */
  radius?: number | CornerRadii
  background?: string
  hoverBackground?: string
}

export default function AnimatedAddToCartButton({
  onClick,
  label = 'Add to cart',
  repeatLabel = 'Add more',
  confirmedLabel = 'Added',
  announcement = 'Added to cart',
  className = 'w-[183px] h-[54px]',
  labelClassName = 'text-[17px] font-medium',
  radius = DEFAULT_RADII,
  background = '#000',
  hoverBackground = '#262626',
}: AnimatedAddToCartButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const bgPathRef = useRef<SVGPathElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  const cupSvgRef = useRef<SVGSVGElement>(null)
  const teaRef = useRef<SVGRectElement>(null)
  const teapotRef = useRef<SVGGElement>(null)
  const streamRef = useRef<SVGPathElement>(null)
  const busy = useRef(false)
  const clipId = `atc-tea-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const radii: CornerRadii = typeof radius === 'number' ? { tl: radius, tr: radius, br: radius, bl: radius } : radius

  const [size, setSize] = useState<Size | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [hasAdded, setHasAdded] = useState(false)
  const [liveText, setLiveText] = useState('')

  // Track the rendered size: the outline is drawn in real pixels so the
  // corner radii stay true at any width.
  useLayoutEffect(() => {
    const el = buttonRef.current
    if (!el) return
    const measure = () => {
      // offsetWidth/Height ignore the press-scale transform.
      const next = { w: el.offsetWidth, h: el.offsetHeight }
      setSize((prev) => (prev && prev.w === next.w && prev.h === next.h ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { contextSafe } = useGSAP({ scope: buttonRef })

  const play = (s: Size) => {
    const q = gsap.utils.selector(buttonRef)
    const cupStrokes = q('[data-cup-stroke]')
    const steam = q('[data-steam]')
    const { pot } = pourGeometry(s.h)
    const potOrigin = `${pot.cx} ${pot.cy}`
    const dip = { v: 0 }
    const drawBg = () => bgPathRef.current?.setAttribute('d', buttonPath(s, dip.v, radii))

    const tl = gsap.timeline({
      onComplete: () => {
        busy.current = false
        setLiveText('')
      },
    })

    // Reset to the start state so every run is identical.
    tl.set(cupSvgRef.current, { opacity: 1 }, 0)
      .set(cupStrokes, { strokeDashoffset: 1, opacity: 0 }, 0)
      .set(teaRef.current, { y: TEA_DEPTH }, 0)
      .set(steam, { strokeDashoffset: 1, opacity: 0, y: 0 }, 0)
      .set(teapotRef.current, { opacity: 0, y: 0, rotation: 0, svgOrigin: potOrigin }, 0)
      .set(streamRef.current, { strokeDashoffset: 1, opacity: 0 }, 0)

    // 1. Press: squash, spring past, settle.
    tl.to(buttonRef.current, { scale: 0.945, duration: ms(150), ease: 'power2.out' }, 0)
      .to(buttonRef.current, { scale: 1.046, duration: ms(120), ease: 'power2.out' }, ms(200))
      .to(buttonRef.current, { scale: 1, duration: ms(110), ease: 'sine.inOut' }, ms(360))

    // 2. Label fades out.
    tl.to(labelRef.current, { opacity: 0, duration: ms(330), ease: 'power1.out' }, ms(350))

    // 3. Cup and saucer draw on, stroke by stroke. Each stroke is revealed as it
    // starts, so round caps on undrawn strokes never show as dots.
    const strokeDur = ms(180)
    const strokeStagger = (ms(950 - 620) - strokeDur) / (cupStrokes.length - 1)
    tl.to(cupStrokes, { opacity: 1, duration: 0.001, stagger: strokeStagger }, ms(620))
    tl.to(cupStrokes, { strokeDashoffset: 0, duration: strokeDur, ease: 'power1.inOut', stagger: strokeStagger }, ms(620))

    // 4. Teapot settles in just above the button.
    tl.fromTo(teapotRef.current, { opacity: 0, y: -4 }, { opacity: 1, y: 0, duration: ms(250), ease: 'power2.out' }, ms(1100))

    // 5. Tilt to pour, hold while it flows, tilt back, lift away.
    tl.to(teapotRef.current, { rotation: TILT, svgOrigin: potOrigin, duration: ms(200), ease: 'power2.inOut' }, ms(1350))
      .to(teapotRef.current, { rotation: TILT + 4, svgOrigin: potOrigin, duration: ms(400), ease: 'sine.inOut' }, ms(1550))
      .to(teapotRef.current, { rotation: 0, svgOrigin: potOrigin, duration: ms(200), ease: 'power2.inOut' }, ms(1950))
      .to(teapotRef.current, { opacity: 0, y: -4, duration: ms(250), ease: 'power1.in' }, ms(2150))

    // 6. The stream runs from the spout into the cup, then its tail follows it down.
    tl.set(streamRef.current, { opacity: 1 }, ms(1480))
      .to(streamRef.current, { strokeDashoffset: 0, duration: ms(150), ease: 'power1.in' }, ms(1480))
      .to(streamRef.current, { strokeDashoffset: -1, duration: ms(150), ease: 'power1.in' }, ms(1950))
      .set(streamRef.current, { opacity: 0 }, ms(2100))

    // 7. The cup fills.
    tl.to(teaRef.current, { y: 0, duration: ms(570), ease: 'power1.out' }, ms(1580))

    // 8. Top edge: give as the teapot arrives, ripple where the stream passes, settle.
    const edge: [number, number, number, string][] = [
      // [to, start ms, end ms, ease]
      [2, 1100, 1250, 'sine.out'],
      [-1.5, 1250, 1450, 'sine.inOut'],
      [1.5, 1500, 1580, 'sine.out'],
      [-0.7, 1580, 1680, 'sine.inOut'],
      [0.5, 1680, 1800, 'sine.inOut'],
      [0, 1800, 1950, 'sine.in'],
    ]
    edge.forEach(([v, start, end, ease]) => {
      tl.to(dip, { v, duration: ms(end - start), ease, onUpdate: drawBg }, ms(start))
    })

    // 9. Steam curls up, rises and fades with the cup.
    tl.set(steam, { opacity: 0.85 }, ms(2100))
      .to(steam, { strokeDashoffset: 0, duration: ms(300), ease: 'sine.out', stagger: ms(120) }, ms(2100))
      .to(steam, { y: -3, duration: ms(500), ease: 'sine.out', stagger: ms(120) }, ms(2300))
      .to(cupSvgRef.current, { opacity: 0, duration: ms(250), ease: 'power1.in' }, ms(2550))

    // 10. Label back. The wording swaps while it is invisible, so it fades back in as "Add more".
    tl.call(() => setHasAdded(true), [], ms(2800))
      .to(labelRef.current, { opacity: 1, duration: ms(300), ease: 'power1.out' }, ms(2850))
  }

  const confirm = () => {
    setConfirmed(true)
    gsap.delayedCall(1.5, () => {
      setConfirmed(false)
      setHasAdded(true)
      setLiveText('')
      busy.current = false
    })
  }

  const handleClick = () => {
    if (busy.current) return
    busy.current = true
    onClick()
    if (announcement) setLiveText(announcement)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // contextSafe registers the tweens with this component, so they are killed if it unmounts mid-run.
    contextSafe(() => (reduced || !size ? confirm() : play(size)))()
  }

  const geometry = size ? pourGeometry(size.h) : null
  // Both art layers are centred on the button and share cup space.
  const centred: CSSProperties = { marginLeft: -CUP_W / 2, marginTop: -CUP_H / 2 }

  return (
    <>
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={`group/atc relative isolate inline-flex cursor-pointer select-none items-center justify-center text-white ${className}`}
      style={{ '--atc-bg': background, '--atc-bg-hover': hoverBackground } as CSSProperties}
    >
      {/* 1. Background. Until measured, the clip layer paints the shape instead. */}
      {size && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-visible"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
        >
          <path
            ref={bgPathRef}
            d={buttonPath(size, 0, radii)}
            className="fill-[var(--atc-bg)] transition-[fill] duration-300 group-hover/atc:fill-[var(--atc-bg-hover)]"
          />
        </svg>
      )}

      {/* 2. Clip layer: label, cup, tea and steam. */}
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ borderRadius: `${radii.tl}px ${radii.tr}px ${radii.br}px ${radii.bl}px`, background: size ? undefined : background }}
      >
        <span ref={labelRef} className={`absolute inset-0 flex items-center justify-center whitespace-nowrap ${labelClassName}`}>
          {confirmed ? confirmedLabel : hasAdded ? repeatLabel : label}
        </span>
        <svg
          ref={cupSvgRef}
          aria-hidden="true"
          width={CUP_W}
          height={CUP_H}
          viewBox={`0 0 ${CUP_W} ${CUP_H}`}
          className="pointer-events-none absolute left-1/2 top-1/2 overflow-visible opacity-0"
          style={centred}
          fill="none"
          stroke="#fff"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={CUP_INTERIOR} />
            </clipPath>
          </defs>
          {/* Tea behind the cup strokes, rising inside the cup's interior. */}
          <g clipPath={`url(#${clipId})`}>
            <rect ref={teaRef} x={CUP_CX - 8} y={TEA_TOP} width={16} height={TEA_DEPTH} fill={TEA} stroke="none" transform={`translate(0 ${TEA_DEPTH})`} />
          </g>
          {CUP_STROKES.map((d) => (
            <path key={d} data-cup-stroke d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} opacity={0} />
          ))}
          {STEAM.map((d) => (
            <path key={d} data-steam d={d} strokeWidth={1} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} opacity={0} />
          ))}
        </svg>
      </span>

      {/* 3. Pour layer: unclipped, so the teapot can sit above the button. */}
      {geometry && (
        <svg
          aria-hidden="true"
          width={CUP_W}
          height={CUP_H}
          viewBox={`0 0 ${CUP_W} ${CUP_H}`}
          className="pointer-events-none absolute left-1/2 top-1/2 z-10 overflow-visible"
          style={centred}
        >
          <path
            ref={streamRef}
            d={geometry.stream}
            fill="none"
            stroke={TEA}
            strokeWidth={1.6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1 1"
            strokeDashoffset={1}
            opacity={0}
          />
          <g ref={teapotRef} opacity={0}>
            <g transform={`translate(${geometry.pot.cx - POT_BODY.x} ${geometry.pot.cy - POT_BODY.y})`}>
              <Teapot />
            </g>
          </g>
        </svg>
      )}
    </button>
    {/* Outside the button, or its text would become part of the button's name. */}
    <span aria-live="polite" className="sr-only">
      {liveText}
    </span>
    </>
  )
}
