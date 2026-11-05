import { useEffect, useRef, useState, type ReactNode } from 'react'
import { describeProductImage, getProductImages, type Product } from '../data/products'
import { Link } from '../lib/router'
import { buildSrcSet } from '../lib/responsiveImages'
import SkeletonImage from './SkeletonImage'

/** How long each photo stays up before the card fades to the next one. */
const HOLD_MS = 3500
const SIZES = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 85vw'

/** A stable 0–1500 ms offset per product, so a grid of cards doesn't swap in lockstep. */
const offsetFor = (slug: string) => [...slug].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % 1500

/**
 * The card's image box. With more than one photo it cross-fades through them
 * on its own, pausing while the pointer or keyboard focus is on the card
 * image, while the card is off screen, and entirely for reduced-motion users.
 * `children` are the overlays (badges, wishlist button).
 */
export default function ProductCardGallery({ product, children }: { product: Product; children?: ReactNode }) {
  const images = getProductImages(product)
  const many = images.length > 1
  const boxRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [inView, setInView] = useState(false)
  // Extra photos are only fetched once the card has been on screen.
  const [armed, setArmed] = useState(false)
  const [paused, setPaused] = useState(false)
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]))
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const box = boxRef.current
    if (!many || !box) return
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting)
      if (entry.isIntersecting) setArmed(true)
    }, { threshold: 0.4 })
    observer.observe(box)
    return () => observer.disconnect()
  }, [many])

  useEffect(() => {
    if (!many || !inView || paused) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // The first swap waits a little longer and is offset per card.
    const delay = index === 0 ? HOLD_MS + offsetFor(product.slug) : HOLD_MS
    const timer = window.setTimeout(() => {
      const next = (index + 1) % images.length
      // Hold while the tab is hidden, and never fade to a photo that hasn't
      // arrived yet — bump `tick` so the timer re-arms and tries again.
      if (document.hidden || !loaded.has(next)) setTick((t) => t + 1)
      else setIndex(next)
    }, delay)
    return () => window.clearTimeout(timer)
  }, [many, inView, paused, index, images.length, loaded, product.slug, tick])

  const markLoaded = (i: number) => setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
  const fade = (i: number) =>
    `w-full h-full object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 ${
      i === index ? 'opacity-100' : 'opacity-0'
    }`

  return (
    <div
      ref={boxRef}
      className="relative aspect-[4/5] bg-[#f5f0e6] overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Link to={`/product/${product.slug}`} aria-label={`View ${product.name}`} className="block w-full h-full">
        <SkeletonImage
          src={images[0]}
          alt={index === 0 ? describeProductImage(product, images[0]) : ''}
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
                alt={i === index ? describeProductImage(product, src) : ''}
                width={800}
                height={1000}
                onLoad={() => markLoaded(i)}
                className={`absolute inset-0 ${fade(i)}`}
              />
            )
          })}
      </Link>

      {children}

      {many && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setArmed(true)
                setIndex(i)
              }}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                i === index ? 'w-5 bg-[#1b261b]' : 'w-2.5 bg-[#1b261b]/25'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
