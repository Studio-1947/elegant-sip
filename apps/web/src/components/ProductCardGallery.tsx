import { useEffect, useRef, useState, type ReactNode } from 'react'
import { describeProductImage, getProductImages, type Product } from '../data/products'
import { Link } from '../lib/router'
import { buildSrcSet } from '../lib/responsiveImages'
import SkeletonImage from './SkeletonImage'

const SIZES = '(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 85vw'

/**
 * The card's image box. Cards hold still: a grid where every card cross-fades
 * on its own timer read as flicker (UX audit). Hovering a card shows its second
 * photo, usually the loose leaf, and the dots switch between all of them.
 * `children` are the overlays (badges, wishlist button).
 */
export default function ProductCardGallery({ product, children }: { product: Product; children?: ReactNode }) {
  const images = getProductImages(product)
  const many = images.length > 1
  const boxRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  // Extra photos are only fetched once the card has been on screen.
  const [armed, setArmed] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set([0]))

  useEffect(() => {
    const box = boxRef.current
    if (!many || !box) return
    // Fetch the extra photos once the card is near the screen, so a hover is instant.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setArmed(true)
    }, { rootMargin: '200px' })
    observer.observe(box)
    return () => observer.disconnect()
  }, [many])

  // On hover, the first photo gives way to the second, once it has loaded.
  const shown = hovering && index === 0 && loaded.has(1) ? 1 : index

  const markLoaded = (i: number) => setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))
  const fade = (i: number) =>
    `w-full h-full object-cover transition-[opacity,transform] duration-700 ease-out group-hover:scale-105 ${
      i === shown ? 'opacity-100' : 'opacity-0'
    }`

  return (
    <div
      ref={boxRef}
      className="relative aspect-[4/5] bg-[#f5f0e6] overflow-hidden"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
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
                onLoad={() => markLoaded(i)}
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
                setIndex(i)
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
