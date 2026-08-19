import { useState } from 'react'
import { useCart } from './CartContext'
import { getReviews, getDefaultVariant, isInStock, type Product } from '../data/products'
import { getLocalReviews } from '../lib/localReviews'
import { Link } from '../lib/router'
import { track } from '../lib/analytics'
import { formatINR } from '../lib/currency'
import { FREE_SHIPPING_THRESHOLD } from '../lib/pricing'
import SkeletonImage from './SkeletonImage'

/* Compact brew-stat values parsed from the full brewing guide strings. */
const celsius = (temperature: string) =>
  temperature.split('/').map((s) => s.trim()).find((s) => s.includes('°C')) ?? temperature
const shortTime = (time: string) => time.replace('minutes', 'min').replace('minute', 'min')
const shortLeaf = (leafAmount: string) => leafAmount.split(' per ')[0]

export default function ProductCard({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart, toggleWishlist, isWishlisted } = useCart()

  // Real average when reviews exist (seed + customer-submitted); a default
  // 5-star display for teas that have none yet.
  const reviews = [...getLocalReviews(product.id), ...getReviews(product.id)]
  const rating =
    reviews.length > 0
      ? {
          average: Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10,
          count: reviews.length,
        }
      : { average: 5, count: 0 }

  const wishlisted = isWishlisted(product.id)
  const defaultVariant = getDefaultVariant(product)
  const inStock = isInStock(product)
  const hasMultipleSizes = product.variants.length > 1
  const comingSoon = product.status === 'coming-soon'
  const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0)
  const gallery = [product.imageSrc, ...(product.images ?? [])]
  const brew = product.brewingGuide

  const handleAddToCart = () => {
    if (!inStock || comingSoon) return
    setIsAdding(true)
    addToCart(
      { id: product.id, name: product.name, price: defaultVariant.price, imageSrc: product.imageSrc, size: defaultVariant.size },
      quantity,
    )
    track('add_to_cart', { product: product.id, quantity, source: 'product_card' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setQuantity(1)
      setTimeout(() => setIsAdded(false), 2000)
    }, 800)
  }

  const handleWishlist = () => {
    toggleWishlist(product.id)
    track('wishlist_toggle', { product: product.id })
  }

  return (
    <div className="group w-full bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* ── Image area ── */}
      <div className="relative aspect-[4/5] bg-[#f5f0e6] overflow-hidden">
        <Link to={`/product/${product.id}`} aria-label={`View ${product.name}`}>
          <SkeletonImage
            src={gallery[imageIndex]}
            alt={product.name}
            loading="lazy"
            wrapperClassName="w-full h-full"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </Link>

        {/* Badges */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-col items-start gap-2">
          {comingSoon ? (
            <span className="bg-[#1b261b] text-white text-[9px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
              Coming Soon
            </span>
          ) : (
            <>
              {product.harvestLabel && (
                <span className="bg-[#1b261b] text-white text-[9px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
                  {product.harvestLabel}
                </span>
              )}
              {totalStock > 0 && (
                <span className="bg-white/90 border border-[#b0782e]/40 text-[#b0782e] text-[9px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
                  Limited · {totalStock} packs
                </span>
              )}
            </>
          )}
        </div>

        {/* Wishlist Heart */}
        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          className={`absolute top-3.5 right-3.5 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-300 cursor-pointer border ${
            wishlisted
              ? 'bg-[#8bb56e] text-white border-[#8bb56e]'
              : 'bg-white/85 text-[#1b261b] border-white/40 hover:bg-white'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>

        {/* Gallery dots (only when the product has extra images) */}
        {gallery.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
            {gallery.map((src, i) => (
              <button
                key={src}
                onClick={() => setImageIndex(i)}
                aria-label={`Show image ${i + 1}`}
                aria-current={i === imageIndex}
                className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${
                  i === imageIndex ? 'w-5 bg-[#1b261b]' : 'w-2.5 bg-[#1b261b]/25'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Info block ── */}
      <div className="p-5 md:p-6 flex flex-col flex-grow">
        {/* Eyebrow */}
        <span className="flex items-center gap-1.5 text-[9px] font-mono tracking-[0.2em] uppercase text-[#4a584a]/70 mb-2">
          <span className="text-[#b0782e] text-[7px]" aria-hidden="true">●</span>
          Darjeeling · Single Origin
        </span>

        {/* Name + price */}
        <div className="flex justify-between items-start gap-3 mb-1.5">
          <Link to={`/product/${product.id}`} className="hover:text-[#8bb56e] transition-colors">
            <h3 className="text-[#1b261b] text-lg lg:text-xl font-bold font-sans tracking-wide leading-snug">{product.name}</h3>
          </Link>
          <span className="flex flex-col items-end pt-0.5">
            {comingSoon ? (
              <span className="text-[9px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#8bb56e] px-2.5 py-1 rounded-full whitespace-nowrap">
                Coming Soon
              </span>
            ) : (
              <span className="text-[#1b261b] text-base lg:text-lg font-bold whitespace-nowrap">
                {hasMultipleSizes && <span className="text-xs font-normal text-[#4a584a]">from </span>}
                {formatINR(product.price)}
              </span>
            )}
          </span>
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-2 mb-3.5">
          <div
            className="flex gap-0.5 text-[#8bb56e] text-xs"
            aria-label={rating.count > 0 ? `Rated ${rating.average} out of 5 stars` : '5 stars'}
          >
            {[...Array(5)].map((_, i) => (
              <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill={i < Math.round(rating.average) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
              </svg>
            ))}
          </div>
          {rating.count > 0 && (
            <span className="text-[10px] font-mono text-[#4a584a]/70">
              {rating.average} · {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
            </span>
          )}
        </div>

        {/* Tasting-note chips */}
        {product.tastingNotes && product.tastingNotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.tastingNotes.map((note) => (
              <span key={note} className="border border-[#1b261b]/15 rounded-full px-3 py-1 text-[10px] text-[#4a584a]">
                {note}
              </span>
            ))}
          </div>
        )}

        {/* Body meter */}
        {product.bodyLevel !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between text-[8px] font-mono tracking-[0.2em] uppercase text-[#4a584a]/60 mb-1.5">
              <span>Light</span>
              <span>Body</span>
              <span>Full</span>
            </div>
            <div className="h-[3px] bg-[#1b261b]/10 rounded-full overflow-hidden">
              <div className="h-full bg-[#b0782e] rounded-full" style={{ width: `${(product.bodyLevel / 5) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Brew stats */}
        {brew && (
          <div className="grid grid-cols-3 divide-x divide-[#1b261b]/10 bg-[#f9faf7] border border-[#1b261b]/10 rounded-xl mb-4">
            {(
              [
                [celsius(brew.temperature), 'Water'],
                [shortTime(brew.time), 'Steep'],
                [shortLeaf(brew.leafAmount), 'Per Cup'],
              ] as [string, string][]
            ).map(([value, label]) => (
              <div key={label} className="text-center py-2.5 px-1">
                <p className="text-xs font-bold text-[#1b261b] whitespace-nowrap">{value}</p>
                <p className="text-[8px] font-mono tracking-[0.2em] uppercase text-[#4a584a]/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Quantity & CTA row */}
        <div className="flex flex-row gap-3 items-stretch mt-auto">
          {!comingSoon && (
            <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-4 py-2 w-24 sm:w-28 bg-white flex-shrink-0">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1 cursor-pointer"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="text-[#1b261b] font-mono text-sm font-semibold select-none">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(q + 1, defaultVariant.stock))}
                className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1 cursor-pointer"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || isAdded || !inStock || comingSoon}
            className={`flex-grow text-[10px] sm:text-xs font-bold tracking-widest uppercase py-3 px-3 sm:px-6 rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${
              !inStock || comingSoon
                ? 'bg-[#1b261b]/10 text-[#4a584a]/60 cursor-not-allowed'
                : isAdded
                ? 'bg-[#8bb56e] text-white'
                : isAdding
                ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
            }`}
          >
            {comingSoon ? 'Coming Soon' : !inStock ? 'Sold Out' : isAdding ? 'Adding...' : isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>

        {/* Footer microcopy */}
        {!comingSoon && (
          <p className="text-[10px] text-[#4a584a]/70 text-center mt-3">
            Free shipping over {formatINR(FREE_SHIPPING_THRESHOLD)} · ships in 24 h
          </p>
        )}
      </div>
    </div>
  )
}
