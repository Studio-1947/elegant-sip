import { useEffect, useRef, useState } from 'react'
import { useCart } from './CartContext'
import { getDefaultVariant, type Product } from '../data/products'
import { Link, navigate } from '../lib/router'
import { track } from '../lib/analytics'
import { formatINR } from '../lib/currency'
import { percentOff } from '../lib/pricing'
import SkeletonImage from './SkeletonImage'
import { useUi } from './UiContext'

/**
 * Compact product tile for phones — two per row in the shop, a swipeable shelf
 * on the homepage. The full card (quantity, Buy now, tasting notes) stays on
 * tablet/desktop and on the product page; on a 390px screen those controls
 * crowded the one thing a shopper scans for: the tea, its name and its price.
 *
 * Every tile has the same box: fixed image ratio, a two-line name slot, a
 * fixed price row and a full-width button, so a grid of tiles never staggers.
 */
export default function ProductTile({ product, sizes = '45vw' }: { product: Product; sizes?: string }) {
  const { addToCart, toggleWishlist, isWishlisted } = useCart()
  const { showToast } = useUi()
  const [added, setAdded] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const variant = getDefaultVariant(product)
  const comingSoon = product.status === 'coming-soon'
  const inStock = !comingSoon && variant.stock > 0
  const off = comingSoon ? null : percentOff(variant.price, variant.compareAtPrice)
  const wishlisted = isWishlisted(product.slug)
  const href = `/product/${product.slug}`

  const handleAdd = () => {
    if (added) {
      navigate('/cart')
      return
    }
    if (!inStock) return
    addToCart(
      { productSlug: product.slug, name: product.name, price: variant.price, imageSrc: product.imageSrc, size: variant.size },
      1,
    )
    showToast(`${product.name} added to your cart`)
    track('add_to_cart', { product: product.slug, name: product.name, variant: variant.size, quantity: 1, value: variant.price, source: 'product_tile' })
    setAdded(true)
    timer.current = window.setTimeout(() => setAdded(false), 2500)
  }

  const handleWishlist = () => {
    toggleWishlist(product.slug)
    showToast(wishlisted ? `${product.name} removed from your wishlist` : `${product.name} saved to your wishlist`)
    track('wishlist_toggle', { product: product.slug })
  }

  return (
    <article className="relative flex flex-col h-full w-full">
      {/* Image — the whole tile's primary tap target */}
      <div className="relative rounded-2xl overflow-hidden bg-[#84854f]/20">
        <Link to={href} aria-label={product.name} className="block">
          <SkeletonImage
            src={product.imageSrc}
            alt=""
            loading="lazy"
            width={1600}
            height={1600}
            sizes={sizes}
            className="w-full aspect-[4/5] object-cover"
          />
        </Link>

        {comingSoon ? (
          // Outlined, not a solid green pill: it must not read like the "% off" deal badge.
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-[#1b261b]/30 text-[#1b261b] text-[11px] font-mono font-bold tracking-wider uppercase px-2 py-1 rounded-md pointer-events-none">
            <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4l2.5 2" /></svg>
            Coming soon
          </span>
        ) : off !== null ? (
          <span className="absolute top-2 left-2 bg-[#4a7333] text-white text-[11px] font-mono font-bold tracking-wider uppercase px-2 py-1 rounded-md pointer-events-none">
            {off}% off
          </span>
        ) : null}

        <button
          onClick={handleWishlist}
          aria-label={wishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={wishlisted}
          className={`absolute top-1 right-1 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer`}
        >
          <span
            className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors ${
              wishlisted ? 'bg-[#8bb56e] text-white' : 'bg-white/85 text-[#1b261b]'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={wishlisted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
          </span>
        </button>
      </div>

      {/* Text — fixed slots so neighbouring tiles line up */}
      <div className="flex flex-col flex-grow pt-3">
        <span className="text-[11px] font-mono tracking-[0.12em] uppercase text-[#4a584a] mb-1 whitespace-nowrap overflow-hidden text-ellipsis">
          {product.category}
        </span>
        <Link to={href} className="mb-1.5">
          <h3 className="text-[#1b261b] text-[15px] font-bold leading-snug line-clamp-2 min-h-[2lh]" title={product.name}>
            {product.name}
          </h3>
        </Link>

        <div className="flex items-baseline gap-1.5 h-6 mb-3 whitespace-nowrap overflow-hidden">
          {comingSoon ? (
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#4a7333]">Price soon</span>
          ) : (
            <>
              <span className="text-[#1b261b] text-base font-bold">{formatINR(variant.price)}</span>
              {off !== null && variant.compareAtPrice && (
                <s className="text-[#4a584a]/70 text-xs">
                  <span className="sr-only">Regular price </span>
                  {formatINR(variant.compareAtPrice)}
                </s>
              )}
              <span className="text-[11px] text-[#4a584a]">/ {variant.size}</span>
            </>
          )}
        </div>

        <button
          onClick={comingSoon ? () => navigate(href) : handleAdd}
          disabled={!comingSoon && !inStock}
          className={`mt-auto h-10 w-full rounded-lg text-[11px] font-bold tracking-wider uppercase transition-colors active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
            comingSoon
              ? 'border border-[#1b261b]/20 text-[#1b261b]'
              : !inStock
              ? 'bg-[#1b261b]/10 text-[#4a584a] cursor-not-allowed'
              : added
              ? 'bg-[#8bb56e] text-white'
              : 'bg-[#1b261b] text-white'
          }`}
        >
          {comingSoon ? (
            'View details'
          ) : !inStock ? (
            'Sold out'
          ) : added ? (
            'View cart'
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add to cart
            </>
          )}
        </button>
        <span aria-live="polite" className="sr-only">{added ? `${product.name} added to your cart` : ''}</span>
      </div>
    </article>
  )
}
