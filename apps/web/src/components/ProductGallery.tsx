import { useState } from 'react'
import { describeProductImage, getProductImages, type Product } from '../data/products'
import SkeletonImage from './SkeletonImage'

/**
 * Product page photos: one large image, previous/next arrows, and a row of
 * thumbnails. Collapses to the plain image when a product has a single photo.
 */
export default function ProductGallery({ product }: { product: Product }) {
  const images = getProductImages(product)
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, images.length - 1)]
  const many = images.length > 1

  const step = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length)

  return (
    <div>
      <div
        className="relative rounded-2xl overflow-hidden border border-[#1b261b]/10 bg-white shadow-[0_12px_40px_rgba(27,38,27,0.04)] aspect-square"
        onKeyDown={(e) => {
          if (!many) return
          if (e.key === 'ArrowLeft') step(-1)
          if (e.key === 'ArrowRight') step(1)
        }}
      >
        <SkeletonImage
          // Remount per photo so the shimmer shows while the next one loads.
          key={current}
          src={current}
          alt={describeProductImage(product, current)}
          width={1600}
          height={1600}
          sizes="(min-width: 1024px) 50vw, 100vw"
          fetchPriority={index === 0 ? 'high' : 'auto'}
          wrapperClassName="w-full h-full"
          className="w-full h-full object-cover"
        />

        {many && (
          <>
            <GalleryArrow direction="prev" onClick={() => step(-1)} />
            <GalleryArrow direction="next" onClick={() => step(1)} />
            <span className="absolute bottom-3 right-3 z-10 bg-white/90 text-[#1b261b] text-[11px] font-mono tracking-widest px-2.5 py-1 rounded-md">
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>

      {many && (
        <div className="relative mt-4 flex gap-3 overflow-x-auto snap-x no-scrollbar" role="group" aria-label={`${product.name} photos`}>
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show photo ${i + 1}: ${describeProductImage(product, src)}`}
              aria-pressed={i === index}
              className={`snap-start flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-xl overflow-hidden border-2 bg-white transition-all duration-300 cursor-pointer ${
                i === index ? 'border-[#1b261b]' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={src.replace(/\.webp$/, '-640.webp')} alt="" width={96} height={96} loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GalleryArrow({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
  const prev = direction === 'prev'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={prev ? 'Previous photo' : 'Next photo'}
      className={`absolute top-1/2 -translate-y-1/2 ${prev ? 'left-3' : 'right-3'} z-10 w-11 h-11 rounded-full bg-white/90 border border-[#1b261b]/10 text-[#1b261b] flex items-center justify-center shadow-sm hover:bg-white transition-colors cursor-pointer`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d={prev ? 'M15 18l-6-6 6-6' : 'M9 6l6 6-6 6'} />
      </svg>
    </button>
  )
}
