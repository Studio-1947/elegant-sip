import { useState } from 'react'
import { useCart } from './CartContext'
import { getRating, getDefaultVariant, isInStock, type Product } from '../data/products'
import { Link } from '../lib/router'
import { track } from '../lib/analytics'
import { formatINR } from '../lib/currency'

export default function ProductCard({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart, toggleWishlist, isWishlisted } = useCart()
  const rating = getRating(product.id)
  const wishlisted = isWishlisted(product.id)
  const saveAmount = product.compareAtPrice ? product.compareAtPrice - product.price : 0
  const defaultVariant = getDefaultVariant(product)
  const inStock = isInStock(product)
  const hasMultipleSizes = product.variants.length > 1

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const handleIncrease = () => {
    setQuantity((q) => Math.min(q + 1, defaultVariant.stock))
  }

  const handleAddToCart = () => {
    if (!inStock) return
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
      setTimeout(() => {
        setIsAdded(false)
      }, 2000)
    }, 800)
  }

  const handleWishlist = () => {
    toggleWishlist(product.id)
    track('wishlist_toggle', { product: product.id })
  }

  const renderDots = (value: number) => {
    return (
      <div className="flex gap-1 items-center">
        {[...Array(5)].map((_, i) => (
          <span
            key={i}
            className={`text-xs leading-none ${i < value ? 'text-[#8bb56e]' : 'text-white/20'}`}
          >
            ●
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="group w-full bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* Product Image Wrapper with Hover Overlay */}
      <div className="relative aspect-[4/5] bg-[#fdfdfd] overflow-hidden">
        <Link to={`/product/${product.id}`} aria-label={`View ${product.name}`}>
          <img
            src={product.imageSrc}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
        </Link>

        {/* Wishlist Heart */}
        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          className={`absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-300 cursor-pointer border ${
            wishlisted
              ? 'bg-[#8bb56e] text-white border-[#8bb56e]'
              : 'bg-white/80 text-[#1b261b] border-white/40 hover:bg-white'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>

        {/* Save badge for sale pricing */}
        {saveAmount > 0 && (
          <span className="absolute top-4 left-4 z-20 bg-[#8bb56e] text-white text-[9px] font-mono tracking-widest uppercase font-bold px-2.5 py-1 rounded-full">
            Save {formatINR(saveAmount)}
          </span>
        )}

        {/* Hover Details Panel (desktop) */}
        {(product.flavorProfile || product.origin) && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-sm text-white p-6 flex flex-col justify-between opacity-0 translate-y-4 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto transition-all duration-500 ease-out z-10">
            <>                {product.origin && (
                  <div className="space-y-2">
                    <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-white/10 pb-1">Tea Origin</span>
                    <div className="grid grid-cols-2 gap-y-1 text-xs">
                      <span className="text-white/60">Origin:</span>
                      <span className="text-right font-medium">{product.origin.origin}</span>
                      <span className="text-white/60">Estate:</span>
                      <span className="text-right font-medium">{product.origin.estate}</span>
                      <span className="text-white/60">Elevation:</span>
                      <span className="text-right font-medium">{product.origin.elevation}</span>
                      <span className="text-white/60">Harvest:</span>
                      <span className="text-right font-medium">{product.origin.harvest}</span>
                      <span className="text-white/60">Cultivar:</span>
                      <span className="text-right font-medium">{product.origin.cultivar}</span>
                    </div>
                  </div>
                )}

                {product.flavorProfile && (
                  <div className="space-y-2">
                    <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-white/10 pb-1">Flavor Profile</span>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Strength:</span>
                        {renderDots(product.flavorProfile.strength)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Astringency:</span>
                        {renderDots(product.flavorProfile.astringency)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Sweetness:</span>
                        {renderDots(product.flavorProfile.sweetness)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Floral:</span>
                        {renderDots(product.flavorProfile.floral)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-white/60">Caffeine:</span>
                        {renderDots(product.flavorProfile.caffeine)}
                      </div>
                    </div>
                  </div>
                )}
              </>

            <div className="text-[10px] font-mono text-center text-[#8bb56e]">
              View details & brewing guide on mobile
            </div>
          </div>
        )}
      </div>

      {/* Info Block */}
      <div className="p-6 md:p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-start gap-3 mb-2">
          <Link to={`/product/${product.id}`} className="hover:text-[#8bb56e] transition-colors">
            <h3 className="text-[#1b261b] text-lg lg:text-xl font-bold font-sans tracking-wide">{product.name}</h3>
          </Link>
          <span className="flex flex-col items-end">
            {product.compareAtPrice && (
              <span className="text-[#4a584a]/50 text-xs line-through">{formatINR(product.compareAtPrice)}</span>
            )}
            <span className="text-[#1b261b] text-base lg:text-lg font-bold whitespace-nowrap">
              {hasMultipleSizes && <span className="text-xs font-normal text-[#4a584a]">from </span>}
              {formatINR(product.price)}
            </span>
          </span>
        </div>

        {/* Star rating */}
        {rating.count > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex gap-0.5 text-[#8bb56e] text-xs" aria-label={`Rated ${rating.average} out of 5 stars`}>
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3 h-3" viewBox="0 0 20 20" fill={i < Math.round(rating.average) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                </svg>
              ))}
            </div>
            <span className="text-[10px] font-mono text-[#4a584a]/70">
              {rating.average} ({rating.count})
            </span>
          </div>
        )}

        <p className="text-[#4a584a] text-xs leading-relaxed mb-6 flex-grow line-clamp-3 md:line-clamp-none">{product.description}</p>

        {/* Quantity & CTA Row */}
        <div className="flex flex-row gap-3 sm:gap-4 items-stretch mt-auto">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-full md:rounded-lg px-4 py-2 w-24 sm:w-28 bg-[#f9faf7] flex-shrink-0">
            <button
              onClick={handleDecrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-[#1b261b] font-mono text-sm font-semibold select-none">{quantity}</span>
            <button
              onClick={handleIncrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || isAdded || !inStock}
            className={`flex-grow text-[10px] sm:text-xs font-bold tracking-widest uppercase py-3 px-3 sm:px-6 rounded-full md:rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${
              !inStock
                ? 'bg-[#1b261b]/10 text-[#4a584a]/60 cursor-not-allowed'
                : isAdded
                ? 'bg-[#8bb56e] text-white'
                : isAdding
                ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
            }`}
          >
            {!inStock ? 'Sold Out' : isAdding ? 'Adding...' : isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}
