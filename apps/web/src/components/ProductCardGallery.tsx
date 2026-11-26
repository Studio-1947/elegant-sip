import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { describeProductImage, getProductImages, type Product } from '../data/products'
import { Link } from '../lib/router'
import { buildSrcSet } from '../lib/responsiveImages'
import SkeletonImage from './SkeletonImage'

const SIZES = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 85vw'

/** How often every card moves to its next photo, together. */
const STEP_MS = 4000
/** After a dot tap, how many shared steps (12 s) that card keeps the shopper's choice before rejoining. */
const HOLD_STEPS = 3

/* One clock for every card on the page. Cards on their own timers read as
   flicker (UX audit): here they all change photo at the same moment, so the
   grid moves as one slideshow. Paused while the tab is hidden; never ticks for
   visitors who prefer reduced motion. */
let tick = 0
let timer = 0
const tickListeners = new Set<() => void>()

function startClock() {
  if (timer || typeof window === 'undefined') return
  if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  timer = window.setInterval(() => {
    if (document.hidden) return
    tick += 1
    tickListeners.forEach((listener) => listener())
  }, STEP_MS)
}

function subscribeTick(listener: () => void) {
  tickListeners.add(listener)
  startClock()
  return () => {
    tickListeners.delete(listener)
    if (tickListeners.size === 0 && timer) {
      window.clearInterval(timer)
      timer = 0
    }
  }
}

const getTick = () => tick

/**
 * The card's image box. Every card with more than one photo steps through
 * them on the shared clock above, in step with the rest of the grid. Tapping
 * a dot shows that photo and holds it a while before the card rejoins.
 * `children` are the overlays (badges, wishlist button).
 */
export default function ProductCardGallery({ product, children }: { product: Product; children?: ReactNode }) {
  const images = getProductImages(product)
  const many = images.length > 1
  const boxRef = useRef<HTMLDivElement>(null)
  const shared = useSyncExternalStore(many ? subscribeTick : () => () => {}, getTick, () => 0)
  // A dot the shopper tapped, and the shared step it was tapped on.
  const [picked, setPicked] = useState<{ index: number; at: number } | null>(null)
  // Extra photos are only fetched once the card has been on screen.
  const [armed, setArmed] = useState(false)

  useEffect(() => {
    const box = boxRef.current
    if (!many || !box) return
    // Fetch the extra photos once the card is near the screen, so a dot tap is instant.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setArmed(true)
    }, { rootMargin: '200px' })
    observer.observe(box)
    return () => observer.disconnect()
  }, [many])

  // The shopper's pick holds for a few shared steps, then the card rejoins the others.
  const holding = picked !== null && shared - picked.at < HOLD_STEPS
  // Until its extra photos are fetched (card near the screen), a card keeps its first one.
  const shown = holding ? picked.index : many && armed ? shared % images.length : 0

  const fade = (i: number) =>
    `w-full h-full object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 ${
      i === shown ? 'opacity-100' : 'opacity-0'
    }`

  return (
    <div
      ref={boxRef}
      className="relative aspect-[4/5] bg-[#f5f0e6] overflow-hidden"
    >
      <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="block w-full h-full">
        <SkeletonImage
          src={images[0]}
          alt={shown === 0 ? describeProductImage(product, images[0]) : ''}
          loading="lazy"
          // Intrinsic 4:5 matching the card's aspect box, so the browser
          // reserves the space before the file lands.
          width={800}
          height={1000}
          sizes={SIZES}
          wrapperClassName="w-full h-full"
          className={fade(0)}
        />
        {armed &&
          images.slice(1).map((src, n) => {
            const i = n + 1
            return (
              <img
                key={src}
                src={src}
                srcSet={buildSrcSet(src)}
                sizes={SIZES}
                alt={i === shown ? describeProductImage(product, src) : ''}
                width={800}
                height={1000}
                className={`absolute inset-0 ${fade(i)}`}
              />
            )
          })}
      </Link>

      {children}

      {many && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 z-20 flex items-center">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setArmed(true)
                setPicked({ index: i, at: shared })
              }}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === shown}
              // A thin bar to look at, inside a finger-sized tap area.
              className="group/dot flex h-6 items-center px-1 cursor-pointer"
            >
              <span
                className={`block h-1 rounded-full transition-all duration-300 ${
                  i === shown ? 'w-5 bg-[#1b261b]' : 'w-2.5 bg-[#1b261b]/25 group-hover/dot:bg-[#1b261b]/50'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
