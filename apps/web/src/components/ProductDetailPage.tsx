import ProductGallery from './ProductGallery'
import { useEffect, useRef, useState } from 'react'
import { getProduct, getDefaultVariant, getGardenForProduct, getProductImages, PRODUCTS } from '../data/products'
import { api, type ReviewView } from '../lib/api'
import { Link, navigate, useDocumentMeta, useJsonLd } from '../lib/router'
import { useCart } from './CartContext'
import { track } from '../lib/analytics'
import { formatINR, RUPEE } from '../lib/currency'
import PriceTag from './PriceTag'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '../lib/pricing'
import { BRAND, absoluteUrl } from '../lib/site'
import { productRouteMeta } from '../lib/seoRoutes'
import ProductCard from './ProductCard'
import ProductTile from './ProductTile'
import ProductInfoCards from './ProductInfoCards'
import ProductReviews from './ProductReviews'
import ProductGardenLine from './ProductGardenLine'
import { useUi } from './UiContext'
import { useStoreSettings } from '../lib/storeSettings'

export default function ProductDetailPage({ id }: { id?: string }) {
  const product = getProduct(id)
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [reviews, setReviews] = useState<ReviewView[]>([])
  const [rating, setRating] = useState(() => product?.rating ?? { average: 0, count: 0 })
  const { addToCart } = useCart()
  const { showToast } = useUi()
  const { guarantee } = useStoreSettings()

  // Phones: once the main buttons scroll out of view, a buy bar docks at the
  // bottom of the screen, in the thumb zone, so buying never needs a scroll back.
  // Only shown after the buttons have been seen and passed (not before reaching them).
  const ctaRef = useRef<HTMLDivElement>(null)
  const [ctaPassed, setCtaPassed] = useState(false)
  useEffect(() => {
    const el = ctaRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => {
      setCtaPassed(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [id])

  // Reset per-product state when navigating between products (same component
  // instance). Done during render so the new product never paints with the old
  // product's quantity, pack or reviews.
  const [prevId, setPrevId] = useState(id)
  if (id !== prevId) {
    setPrevId(id)
    setQuantity(1)
    setSelectedSize(null)
    setIsAdding(false)
    setIsAdded(false)
    setReviews([])
    setRating(product?.rating ?? { average: 0, count: 0 })
  }

  useEffect(() => {
    if (!id) return
    // Published reviews are fetched live; the snapshot's rating is the
    // build-time figure and is replaced as soon as the API answers.
    let cancelled = false
    void api.reviews
      .list(id)
      .then((r) => {
        if (cancelled) return
        setReviews(r.reviews)
        setRating({ average: r.average, count: r.count })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id])

  const variant = product
    ? product.variants.find((v) => v.size === selectedSize) ?? getDefaultVariant(product)
    : undefined
  const variantInStock = (variant?.stock ?? 0) > 0
  const comingSoon = product?.status === 'coming-soon'

  // One product view per product opened, priced at the default pack.
  useEffect(() => {
    if (!product) return
    const shown = getDefaultVariant(product)
    track('view_item', { product: product.slug, name: product.name, ...(shown && !comingSoon ? { variant: shown.size, value: shown.price } : {}) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.slug])

  useDocumentMeta(
    product ? productRouteMeta(product.slug)!.title : 'Product not found | Elegant Sip',
    product ? product.description : undefined,
    product
      ? { canonical: `/product/${product.slug}`, image: product.imageSrc }
      : { noindex: true },
  )

  useJsonLd(
    product && variant
      ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${absoluteUrl(`/product/${product.slug}`)}#product`,
        name: product.name,
        description: product.longDescription ?? product.description,
        image: getProductImages(product).map(absoluteUrl),
        url: absoluteUrl(`/product/${product.slug}`),
        sku: product.slug,
        category: product.category === 'Herbal Tea' ? product.category : `Darjeeling ${product.category}`,
        itemCondition: 'https://schema.org/NewCondition',
        brand: { '@type': 'Brand', name: BRAND },
        ...(product.tastingNotes?.length
          ? { additionalProperty: product.tastingNotes.map((note) => ({ '@type': 'PropertyValue', name: 'Tasting note', value: note })) }
          : {}),
        // Coming-soon items have no price yet — declaring a ₹0 offer would be wrong.
        ...(product.status !== 'coming-soon'
          ? {
            offers: {
              '@type': 'AggregateOffer',
              priceCurrency: 'INR',
              lowPrice: Math.min(...product.variants.map((v) => v.price)) / RUPEE,
              highPrice: Math.max(...product.variants.map((v) => v.price)) / RUPEE,
              offerCount: product.variants.length,
              offers: product.variants.map((v) => ({
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: v.price / RUPEE,
                name: v.size,
                sku: `${product.slug}--${v.size.split(' · ')[0].toLowerCase()}`,
                url: absoluteUrl(`/product/${product.slug}`),
                itemCondition: 'https://schema.org/NewCondition',
                availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                seller: { '@id': 'https://elegantsip.in/#organization' },
                shippingDetails: {
                  '@type': 'OfferShippingDetails',
                  shippingRate: {
                    '@type': 'MonetaryAmount',
                    value: SHIPPING_METHODS[0].fee / RUPEE,
                    currency: 'INR',
                  },
                  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
                },
                // Only while the shop offers its guarantee, with the days staff set.
                ...(guarantee.enabled
                  ? {
                    hasMerchantReturnPolicy: {
                      '@type': 'MerchantReturnPolicy',
                      applicableCountry: 'IN',
                      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                      merchantReturnDays: guarantee.days,
                      returnMethod: 'https://schema.org/ReturnByMail',
                      returnFees: 'https://schema.org/FreeReturn',
                    },
                  }
                  : {}),
              })),
            },
          }
          : {}),
        // Only declared when real customer reviews exist — never a default.
        ...(rating.count > 0
          ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: rating.average,
              reviewCount: rating.count,
            },
            review: reviews.slice(0, 5).map((r) => ({
              '@type': 'Review',
              author: { '@type': 'Person', name: r.author },
              datePublished: r.publishedAt,
              reviewBody: r.text,
              reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
            })),
          }
          : {}),
      }
      : null,
  )

  useJsonLd(
    product
      ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
          { '@type': 'ListItem', position: 2, name: 'Shop', item: absoluteUrl('/shop') },
          {
            '@type': 'ListItem',
            position: 3,
            name: product.name,
            item: absoluteUrl(`/product/${product.slug}`),
          },
        ],
      }
      : null,
    'breadcrumb-jsonld',
  )

  if (!product) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] pt-40 pb-24 px-6 text-center">
        <h1 className="text-3xl font-bold mb-4">This tea has left the shelf</h1>
        <p className="text-sm text-[#4a584a] mb-8">The product you're looking for doesn't exist or is no longer available.</p>
        <Link to="/shop" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
          Browse the Collection
        </Link>
      </div>
    )
  }

  // Prefer same-category teas, fill from the rest of the catalogue. Coming-soon
  // teas are excluded — a "you may also love" rail should be shoppable.
  const buyable = PRODUCTS.filter((p) => p.slug !== product.slug && p.status !== 'coming-soon')
  const related = [
    ...buyable.filter((p) => p.category === product.category),
    ...buyable.filter((p) => p.category !== product.category),
  ].slice(0, 3)
  const activeVariant = variant!
  // Resolved through the API's explicit product↔garden link, not a name match.
  const garden = getGardenForProduct(product.slug)

  const handleAddToCart = () => {
    if (isAdded) {
      navigate('/cart')
      return
    }
    if (!variantInStock) return
    setIsAdding(true)
    addToCart(
      { productSlug: product.slug, name: product.name, price: activeVariant.price, imageSrc: product.imageSrc, size: activeVariant.size },
      quantity,
    )
    showToast(`${product.name} added to your cart`)
    track('add_to_cart', { product: product.slug, name: product.name, variant: activeVariant.size, quantity, value: activeVariant.price * quantity, source: 'product_detail' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setQuantity(1)
      setTimeout(() => setIsAdded(false), 2000)
    }, 800)
  }

  const handleBuyNow = () => {
    if (!variantInStock || comingSoon) return
    addToCart(
      { productSlug: product.slug, name: product.name, price: activeVariant.price, imageSrc: product.imageSrc, size: activeVariant.size },
      quantity,
    )
    track('add_to_cart', { product: product.slug, name: product.name, variant: activeVariant.size, quantity, value: activeVariant.price * quantity, source: 'product_detail_buy_now' })
    navigate('/checkout')
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        {/* Visible breadcrumb mirrors the BreadcrumbList JSON-LD above. */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-2 text-xs font-mono tracking-widest uppercase text-[#4a584a]">
            <li>
              <Link to="/" className="hover:text-[#5f8f42] transition-colors">Home</Link>
            </li>
            <li aria-hidden="true" className="text-[#4a584a]">/</li>
            <li>
              <Link to="/shop" className="hover:text-[#5f8f42] transition-colors">Shop</Link>
            </li>
            <li aria-hidden="true" className="text-[#4a584a]">/</li>
            <li aria-current="page" className="text-[#1b261b] font-semibold normal-case tracking-normal">
              {product.name}
            </li>
          </ol>
        </nav>

        {/* Hero grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start mb-24">
          {/* Photos */}
          <ProductGallery key={product.slug} product={product} />

          {/* Info */}
          <div>
            <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
              {product.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] mb-4">{product.name}</h1>
            <ProductGardenLine productSlug={product.slug} />

            {/* Rating */}
            {rating.count > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div role="img" className="flex gap-0.5 text-[#4a7333] text-sm" aria-label={`Rated ${rating.average} out of 5 stars from ${rating.count} ${rating.count === 1 ? 'review' : 'reviews'}`}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={i < Math.round(rating.average) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs font-mono text-[#4a584a]">{rating.average} · {rating.count} reviews</span>
              </div>
            )}

            {comingSoon ? (
              <p className="inline-block bg-[#8bb56e]/10 border border-[#8bb56e]/30 rounded-lg px-4 py-2.5 text-[#4a7333] text-xs font-mono font-bold tracking-widest uppercase mb-6">
                Coming soon · next harvest
              </p>
            ) : (
              <div className="flex flex-col items-start gap-1.5 mb-6">
                <PriceTag price={activeVariant.price} compareAtPrice={activeVariant.compareAtPrice} size="page" />
                <span className="text-xs font-mono text-[#4a584a]">/ {activeVariant.size} · incl. GST</span>
              </div>
            )}

            <p className="text-sm text-[#4a584a] leading-relaxed mb-4">{product.description}</p>
            {product.longDescription && (
              <a
                href="#about-this-tea"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('about-this-tea')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="inline-block mb-8 py-2 -my-2 text-xs font-mono tracking-widest uppercase text-[#4a7333] hover:text-[#1b261b] underline decoration-[#8bb56e]/50 underline-offset-4 transition-colors"
              >
                Read the full description ↓
              </a>
            )}

            {/* Size picker */}
            {product.variants.length > 1 && (
              <div className="mb-6">
                <span className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-2.5">Size</span>
                <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Size">
                  {product.variants.map((v) => {
                    const selected = v.size === activeVariant.size
                    const soldOut = v.stock <= 0
                    return (
                      <button
                        key={v.size}
                        role="radio"
                        aria-checked={selected}
                        disabled={soldOut}
                        onClick={() => {
                          setSelectedSize(v.size)
                          setQuantity(1)
                        }}
                        className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${soldOut
                            ? 'border-[#1b261b]/10 text-[#4a584a] line-through cursor-not-allowed bg-[#f9faf7]'
                            : selected
                              ? 'border-[#1b261b] bg-[#1b261b] text-white'
                              : 'border-[#1b261b]/20 bg-white text-[#1b261b] hover:border-[#8bb56e]'
                          }`}
                      >
                        {v.size} · {formatINR(v.price)}
                        {soldOut && <span className="no-underline ml-1.5 text-[11px] font-mono uppercase">Sold out</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Scarcity — an honest lot count, in the brand's voice */}
            {variantInStock && activeVariant.stock <= 5 && (
              <p className="text-xs font-mono text-[#b0782e] mb-6">
                Only {activeVariant.stock} left in this lot — when it's gone, it's gone until next harvest.
              </p>
            )}

            {/* Qty + CTAs.
                - Quantity sits beside Add to cart (proximity: it modifies that action).
                - Both actions share one 56px height and radius; Add to cart is the
                  single filled button (hierarchy), Buy now the outlined alternative.
                - Every target is at least 44px (Fitts).
                - Below 340px wide the stepper takes its own row, so nothing is pushed off screen. */}
            <div ref={ctaRef} className="grid grid-cols-1 min-[340px]:grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] gap-3 mb-8">
              {!comingSoon && (
                <div className="flex items-center justify-between min-[340px]:justify-start h-14 border border-[#1b261b]/20 rounded-xl bg-white" role="group" aria-label="Quantity">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    className="w-11 h-full flex items-center justify-center text-lg font-bold text-[#1b261b] hover:text-[#4a7333] disabled:text-[#1b261b]/25 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-mono text-sm font-semibold select-none" aria-live="polite">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(q + 1, activeVariant.stock))}
                    disabled={quantity >= activeVariant.stock}
                    className="w-11 h-full flex items-center justify-center text-lg font-bold text-[#1b261b] hover:text-[#4a7333] disabled:text-[#1b261b]/25 transition-colors cursor-pointer disabled:cursor-not-allowed"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              )}
              <button
                onClick={handleAddToCart}
                disabled={isAdding || !variantInStock || comingSoon}
                className={`${comingSoon ? 'min-[340px]:col-span-2 sm:col-span-3' : ''} h-14 px-5 rounded-xl text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-all duration-300 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 ${!variantInStock || comingSoon
                    ? 'bg-[#1b261b]/10 text-[#4a584a] cursor-not-allowed'
                    : isAdded ? 'bg-[#8bb56e] text-white' : isAdding ? 'bg-[#1b261b]/50 text-white/50 cursor-wait' : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
                  }`}
              >
                {comingSoon ? 'Coming soon' : !variantInStock ? 'Sold out' : isAdding ? 'Adding…' : isAdded ? 'Go to cart' : (
                  'Add to cart'
                )}
              </button>
              {!comingSoon && variantInStock && (
                <button
                  onClick={handleBuyNow}
                  disabled={isAdding}
                  className="min-[340px]:col-span-2 sm:col-span-1 h-14 px-6 rounded-xl border-[1.5px] border-[#1b261b] text-[#1b261b] text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-colors hover:bg-[#1b261b] hover:text-white active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  Buy now
                </button>
              )}
            </div>

            {/* Trust microcopy */}
            <ul className="space-y-2 text-xs text-[#4a584a]">
              <li className="flex items-center gap-2">
                <span className="text-[#4a7333]">✓</span> Free shipping on orders of {formatINR(FREE_SHIPPING_THRESHOLD)} or more
              </li>
              {guarantee.enabled && (
                <li className="flex items-center gap-2">
                  <span className="text-[#4a7333]">✓</span> The Elegant Sip Promise — {guarantee.days}-day satisfaction guarantee
                </li>
              )}
              <li className="flex items-center gap-2">
                <span className="text-[#4a7333]">✓</span> Packed within weeks of harvest, dated on every pack
              </li>
            </ul>
          </div>
        </div>

        {/* Full description, always open: split on blank lines into paragraphs */}
        {product.longDescription && (
          <section id="about-this-tea" aria-labelledby="about-this-tea-heading" className="scroll-mt-32 mb-12 md:mb-16 max-w-3xl">
            <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">The Tea</span>
            <h2 id="about-this-tea-heading" className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-6">
              About {product.name}
            </h2>
            <div className="space-y-4 text-[15px] text-[#4a584a] leading-relaxed">
              {product.longDescription
                .split(/\n\s*\n/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
            </div>
            {product.tastingNotes?.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mr-1">Tasting notes</span>
                {product.tastingNotes.map((note) => (
                  <span key={note} className="px-3 py-1 rounded-full border border-[#8bb56e]/40 bg-[#8bb56e]/10 text-xs text-[#4a7333]">
                    {note}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Details: Origin + Flavor + Brewing */}
        <ProductInfoCards product={product} garden={garden} />

        {/* Reviews */}
        <ProductReviews
          productSlug={product.slug}
          reviews={reviews}
          rating={rating}
          onAdded={(entry) => {
            /* Held for moderation, so it does not join the published list —
               ProductReviews tells the customer that itself. */
            void entry
          }}
        />

        {/* Related */}
        {related.length > 0 && (
          <div>
            <div className="text-center mb-10">
              <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Continue the Journey</span>
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">You May Also Love</h2>
            </div>
            {/* Phones: the same compact tiles as the shop */}
            <div className="md:hidden relative flex overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar gap-3 -mx-6 px-6 scroll-px-6">
              {related.map((item) => (
                <div key={item.id} className="w-[42vw] max-w-[220px] flex-shrink-0 snap-start flex">
                  <ProductTile product={item} />
                </div>
              ))}
            </div>
            <div className="hidden md:grid md:grid-cols-3 md:gap-8">
              {related.map((item) => (
                <div key={item.id} className="flex">
                  <ProductCard product={item} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Phone buy bar — docks in the thumb zone once the main buttons scroll away */}
      {!comingSoon && variantInStock && (
        <>
          <div
            className={`md:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-[#1b261b]/10 px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 ${
              ctaPassed ? 'translate-y-0' : 'translate-y-full'
            }`}
            aria-hidden={!ctaPassed}
            inert={!ctaPassed}
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-grow">
                <p className="text-[13px] font-bold text-[#1b261b] truncate">{product.name}</p>
                <p className="text-xs text-[#4a584a]">
                  <span className="font-bold text-[#1b261b]">{formatINR(activeVariant.price)}</span>
                  {activeVariant.compareAtPrice && activeVariant.compareAtPrice > activeVariant.price && (
                    <s className="ml-1.5 opacity-70">{formatINR(activeVariant.compareAtPrice)}</s>
                  )}
                  <span className="ml-1.5">/ {activeVariant.size}</span>
                </p>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={isAdding}
                className={`h-12 px-5 rounded-xl text-xs font-bold tracking-wider uppercase whitespace-nowrap active:scale-[0.98] transition-colors cursor-pointer ${
                  isAdded ? 'bg-[#8bb56e] text-white' : 'bg-[#1b261b] text-white'
                }`}
              >
                {isAdding ? 'Adding…' : isAdded ? 'Go to cart' : 'Add to cart'}
              </button>
            </div>
          </div>
          {/* Keeps the footer's last line clear of the bar */}
          <div className="md:hidden h-16" aria-hidden="true" />
        </>
      )}
    </div>
  )
}
