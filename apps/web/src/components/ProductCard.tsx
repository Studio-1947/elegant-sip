import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useCart } from './CartContext'
import { getDefaultVariant, isInStock, type Product } from '../data/products'
import { Link, navigate } from '../lib/router'
import { track } from '../lib/analytics'
import { formatINR } from '../lib/currency'
import PriceTag from './PriceTag'
import { FREE_SHIPPING_THRESHOLD } from '../lib/pricing'
import ProductCardGallery from './ProductCardGallery'
import { useUi } from './UiContext'

export default function ProductCard({ product }: { product: Product }) {
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart, toggleWishlist, isWishlisted } = useCart()
  const { showToast } = useUi()

  // Derived server-side from published reviews and carried on the product, so
  // there is no per-render localStorage read and no invented default.
  const rating = product.rating

  const wishlisted = isWishlisted(product.slug)
  // Selected quality tier drives the price, quantity cap, and add-to-cart.
  const activeVariant = product.variants.find((v) => v.size === selectedSize) ?? getDefaultVariant(product)
  const variantInStock = activeVariant.stock > 0
  const inStock = isInStock(product)
  const hasMultipleSizes = product.variants.length > 1
  const comingSoon = product.status === 'coming-soon'
  const totalStock = product.variants.reduce((acc, v) => acc + v.stock, 0)

  // Tracked so pending state flips are cancelled if the card unmounts mid-add
  // (navigating away, filtering the grid) instead of setting state on a dead
  // component.
  const timers = useRef<number[]>([])
  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
    },
    [],
  )

  const handleAddToCart = () => {
    if (isAdded) {
      navigate('/cart')
      return
    }
    if (!variantInStock || comingSoon) return
    setIsAdding(true)
    addToCart(
      { productSlug: product.slug, name: product.name, price: activeVariant.price, imageSrc: product.imageSrc, size: activeVariant.size },
      quantity,
    )
    showToast(`${product.name} added to your cart`)
    track('add_to_cart', { product: product.slug, quantity, source: 'product_card' })
    timers.current.push(
      window.setTimeout(() => {
        setIsAdding(false)
        setIsAdded(true)
        setQuantity(1)
        timers.current.push(window.setTimeout(() => setIsAdded(false), 2000))
      }, 800),
    )
  }

  const handleBuyNow = () => {
    if (!variantInStock || comingSoon) return
    addToCart(
      { productSlug: product.slug, name: product.name, price: activeVariant.price, imageSrc: product.imageSrc, size: activeVariant.size },
      quantity,
    )
    track('add_to_cart', { product: product.slug, quantity, source: 'product_card_buy_now' })
    navigate('/checkout')
  }

  // Roving arrow-key navigation for the tier picker, as ARIA radiogroup requires.
  const handleTierKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const selectable = product.variants.filter((v) => v.stock > 0)
    if (selectable.length === 0) return
    const current = selectable.findIndex((v) => v.size === activeVariant.size)
    const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown'
    const next = (current + (forward ? 1 : -1) + selectable.length) % selectable.length
    setSelectedSize(selectable[next].size)
    setQuantity(1)
  }

  const handleWishlist = () => {
    toggleWishlist(product.slug)
    showToast(wishlisted ? `${product.name} removed from your wishlist` : `${product.name} saved to your wishlist`)
    track('wishlist_toggle', { product: product.slug })
  }

  return (
    <div className="group w-full bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* ── Image area ── */}
      <ProductCardGallery product={product}>
        {/* Badges */}
        <div className="absolute top-3.5 left-3.5 z-20 flex flex-col items-start gap-2">
          {comingSoon ? (
            <span className="bg-[#1b261b] text-white text-[11px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
              Coming Soon
            </span>
          ) : (
            <>
              {product.harvestLabel && (
                <span className="bg-[#1b261b] text-white text-[11px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
                  {product.harvestLabel}
                </span>
              )}
              {totalStock > 0 && (
                <span className="bg-white/90 border border-[#b0782e]/40 text-[#b0782e] text-[11px] font-mono font-bold tracking-widest uppercase px-3 py-1.5 rounded-md">
                  Limited lot
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
          className={`absolute top-2 right-2 z-20 w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-300 cursor-pointer border ${
            wishlisted
              ? 'bg-[#8bb56e] text-white border-[#8bb56e]'
              : 'bg-white/85 text-[#1b261b] border-white/40 hover:bg-white'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>

      </ProductCardGallery>

      {/* ── Info block ── */}
      <div className="p-5 md:p-6 flex flex-col flex-grow">
        {/* Eyebrow */}
        <span className="flex items-center gap-1.5 text-[11px] font-mono tracking-[0.1em] sm:tracking-[0.15em] uppercase text-[#4a584a] mb-2 whitespace-nowrap overflow-hidden">
          <span className="text-[#b0782e] text-[7px]" aria-hidden="true">●</span>
          {/* Herbal blends are not Darjeeling single-origin tea, so they must not say so. */}
          {product.category === 'Herbal Tea' ? 'Herbal · Caffeine free' : 'Darjeeling · Single Origin'}
        </span>

        {/* Name, then price on its own fixed-height row, so every card lines up
            whatever the name length or whether the tea is priced yet. */}
        <Link to={`/product/${product.slug}`} className="hover:text-[#4a7333] transition-colors mb-1.5">
          <h3 className="text-[#1b261b] text-lg lg:text-xl font-bold font-sans tracking-wide leading-snug line-clamp-2 min-h-[2lh]" title={product.name}>{product.name}</h3>
        </Link>
        <div className="flex items-center h-8 mb-1">
          {comingSoon ? (
            <span className="text-[11px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#4a7333] px-2.5 py-1 rounded-full whitespace-nowrap">
              Price coming soon
            </span>
          ) : (
            <PriceTag price={activeVariant.price} compareAtPrice={activeVariant.compareAtPrice} />
          )}
        </div>

        {/* Star rating — only when real reviews exist. */}
        <div className="flex items-center gap-2 mb-3.5 min-h-[18px]">
          {rating.count > 0 ? (
            <>
              <div
                role="img"
                className="flex gap-0.5 text-[#4a7333] text-xs"
                aria-label={`Rated ${rating.average} out of 5 stars from ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`}
              >
                {[...Array(5)].map((_, i) => (
                  <svg key={i} aria-hidden="true" className="w-3 h-3" viewBox="0 0 20 20" fill={i < Math.round(rating.average) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                  </svg>
                ))}
              </div>
              <span className="text-[11px] font-mono text-[#4a584a]">
                {rating.average} · {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-mono text-[#4a584a]">Not yet reviewed</span>
          )}
        </div>

        {/* Tasting-note chips */}
        {product.tastingNotes && product.tastingNotes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {product.tastingNotes.map((note) => (
              <span key={note} className="border border-[#1b261b]/15 rounded-full px-2.5 sm:px-3 py-1 text-[11px] text-[#4a584a] whitespace-nowrap">
                {note}
              </span>
            ))}
          </div>
        )}

        {/* Size picker. Rich brewing information is available in the product view. */}
        {!comingSoon && hasMultipleSizes && (
          <div className="mb-4">
            <span className="block text-[11px] font-mono tracking-[0.2em] uppercase text-[#4a584a] mb-1.5">Size</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Size" onKeyDown={handleTierKeys}>
              {product.variants.map((v) => {
                const selected = v.size === activeVariant.size
                const soldOut = v.stock <= 0
                return (
                  <button
                    key={v.size}
                    role="radio"
                    aria-checked={selected}
                    // Roving tabindex: the group is one tab stop, arrows move within it.
                    tabIndex={selected ? 0 : -1}
                    disabled={soldOut}
                    onClick={() => {
                      setSelectedSize(v.size)
                      setQuantity(1)
                    }}
                    className={`text-[11px] font-semibold px-3 py-2 rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                      soldOut
                        ? 'border-[#1b261b]/10 text-[#4a584a] line-through cursor-not-allowed bg-[#f9faf7]'
                        : selected
                        ? 'border-[#1b261b] bg-[#1b261b] text-white'
                        : 'border-[#1b261b]/15 bg-white text-[#1b261b] hover:border-[#8bb56e]'
                    }`}
                  >
                    {v.size.split(' · ')[0]} · {formatINR(v.price)}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Quantity & CTA row */}
        <div className="flex flex-row gap-2 items-stretch h-11 mt-auto">
          {!comingSoon && (
            <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-3 py-2 w-24 sm:w-28 bg-white flex-shrink-0">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="text-[#1b261b] hover:text-[#4a7333] font-bold text-lg leading-none transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mx-2 -my-2 cursor-pointer"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="text-[#1b261b] font-mono text-sm font-semibold select-none">{quantity}</span>
              <button
                onClick={() => setQuantity((q) => Math.min(q + 1, activeVariant.stock))}
                className="text-[#1b261b] hover:text-[#4a7333] font-bold text-lg leading-none transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -mx-2 -my-2 cursor-pointer"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}
          <button
            onClick={handleAddToCart}
            disabled={isAdding || !variantInStock || comingSoon}
            className={`flex-grow whitespace-nowrap text-[11px] font-bold tracking-normal uppercase py-3 px-2 rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${
              !variantInStock || comingSoon
                ? 'bg-[#1b261b]/10 text-[#4a584a] cursor-not-allowed'
                : isAdded
                ? 'bg-[#8bb56e] text-white'
                : isAdding
                ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
            }`}
          >
            {comingSoon
              ? 'Coming Soon'
              : !inStock
              ? 'Sold Out'
              : !variantInStock
              ? 'Sold Out'
              : isAdding
              ? 'Adding...'
              : isAdded
              ? 'Go to Cart'
              : 'Add to Cart'}
          </button>
          {!comingSoon && variantInStock && (
            <button
              onClick={handleBuyNow}
              disabled={isAdding}
              className="flex items-center justify-center text-center whitespace-nowrap border border-[#1b261b]/25 px-3 rounded-lg text-[11px] font-bold tracking-normal uppercase text-[#1b261b] transition-colors hover:border-[#4a7333] hover:text-[#4a7333] disabled:opacity-50"
            >
              Buy now
            </button>
          )}
        </div>

        {/* Status for assistive tech — the visual button label changes, but a
          screen reader gets no announcement without a live region. */}
      <span aria-live="polite" className="sr-only">
        {isAdded ? `${product.name} added to your cart` : ''}
      </span>

      {/* Footer microcopy */}
        <p className="text-[11px] text-[#4a584a] text-center mt-3 whitespace-nowrap overflow-hidden text-ellipsis">
          {comingSoon
            ? 'Arriving with the next harvest'
            : `Free shipping over ${formatINR(FREE_SHIPPING_THRESHOLD)}`}
        </p>
      </div>
    </div>
  )
}
