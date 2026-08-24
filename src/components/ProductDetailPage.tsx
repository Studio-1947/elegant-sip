import { useEffect, useState } from 'react'
import { getProduct, getReviews, getDefaultVariant, getGardenByEstate, PRODUCTS, type Review } from '../data/products'
import { Link, useDocumentMeta, useJsonLd } from '../lib/router'
import { useCart } from './CartContext'
import { track } from '../lib/analytics'
import { getLocalReviews } from '../lib/localReviews'
import { formatINR } from '../lib/currency'
import { FREE_SHIPPING_THRESHOLD, SHIPPING_METHODS } from '../lib/pricing'
import { BRAND, absoluteUrl } from '../lib/site'
import { productRouteMeta } from '../lib/seoRoutes'
import ProductCard from './ProductCard'
import ProductInfoCards from './ProductInfoCards'
import ProductReviews from './ProductReviews'

export default function ProductDetailPage({ id }: { id?: string }) {
  const product = getProduct(id)
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [localReviews, setLocalReviews] = useState<Review[]>([])
  const { addToCart } = useCart()

  // Reset per-product state when navigating between products (same component instance)
  useEffect(() => {
    setQuantity(1)
    setSelectedSize(null)
    setIsAdding(false)
    setIsAdded(false)
    setLocalReviews(id ? getLocalReviews(id) : [])
  }, [id])

  const variant = product
    ? product.variants.find((v) => v.size === selectedSize) ?? getDefaultVariant(product)
    : undefined
  const variantInStock = (variant?.stock ?? 0) > 0
  const comingSoon = product?.status === 'coming-soon'

  const productReviews = product ? [...localReviews, ...getReviews(product.id)] : []
  const productRating =
    productReviews.length === 0
      ? { average: 0, count: 0 }
      : {
        average:
          Math.round((productReviews.reduce((acc, r) => acc + r.rating, 0) / productReviews.length) * 10) / 10,
        count: productReviews.length,
      }

  useDocumentMeta(
    product ? productRouteMeta(product.id)!.title : 'Product not found | Elegant Sip',
    product ? product.description : undefined,
    product
      ? { canonical: `/product/${product.id}`, image: product.imageSrc }
      : { noindex: true },
  )

  useJsonLd(
    product && variant
      ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        '@id': `${absoluteUrl(`/product/${product.id}`)}#product`,
        name: product.name,
        description: product.longDescription ?? product.description,
        image: [absoluteUrl(product.imageSrc)],
        url: absoluteUrl(`/product/${product.id}`),
        sku: product.id,
        category: `Darjeeling ${product.category}`,
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
              lowPrice: Math.min(...product.variants.map((v) => v.price)),
              highPrice: Math.max(...product.variants.map((v) => v.price)),
              offerCount: product.variants.length,
              offers: product.variants.map((v) => ({
                '@type': 'Offer',
                priceCurrency: 'INR',
                price: v.price,
                name: v.size,
                sku: `${product.id}--${v.size.split(' · ')[0].toLowerCase()}`,
                url: absoluteUrl(`/product/${product.id}`),
                itemCondition: 'https://schema.org/NewCondition',
                availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                seller: { '@id': 'https://elegantsip.com/#organization' },
                shippingDetails: {
                  '@type': 'OfferShippingDetails',
                  shippingRate: {
                    '@type': 'MonetaryAmount',
                    value: SHIPPING_METHODS[0].fee,
                    currency: 'INR',
                  },
                  shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' },
                },
                hasMerchantReturnPolicy: {
                  '@type': 'MerchantReturnPolicy',
                  applicableCountry: 'IN',
                  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                  merchantReturnDays: 30,
                  returnMethod: 'https://schema.org/ReturnByMail',
                  returnFees: 'https://schema.org/FreeReturn',
                },
              })),
            },
          }
          : {}),
        // Only declared when real customer reviews exist — never a default.
        ...(productRating.count > 0
          ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: productRating.average,
              reviewCount: productRating.count,
            },
            review: productReviews.slice(0, 5).map((r) => ({
              '@type': 'Review',
              author: { '@type': 'Person', name: r.author },
              datePublished: r.date,
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
            item: absoluteUrl(`/product/${product.id}`),
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

  const reviews = productReviews
  const rating = productRating
  // Prefer same-category teas, fill from the rest of the catalogue. Coming-soon
  // teas are excluded — a "you may also love" rail should be shoppable.
  const buyable = PRODUCTS.filter((p) => p.id !== product.id && p.status !== 'coming-soon')
  const related = [
    ...buyable.filter((p) => p.category === product.category),
    ...buyable.filter((p) => p.category !== product.category),
  ].slice(0, 3)
  const activeVariant = variant!
  const garden = product.origin ? getGardenByEstate(product.origin.estate) : undefined

  const handleAddToCart = () => {
    if (!variantInStock) return
    setIsAdding(true)
    addToCart(
      { id: product.id, name: product.name, price: activeVariant.price, imageSrc: product.imageSrc, size: activeVariant.size },
      quantity,
    )
    track('add_to_cart', { product: product.id, quantity, source: 'product_detail' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setQuantity(1)
      setTimeout(() => setIsAdded(false), 2000)
    }, 800)
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
          {/* Image */}
          <div className="relative rounded-2xl overflow-hidden border border-[#1b261b]/10 bg-white shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
            <img
              src={product.imageSrc}
              alt={`${product.name} — loose-leaf Darjeeling ${product.category.toLowerCase()} tea in an Elegant Sip pack`}
              width={1200}
              height={1500}
              fetchPriority="high"
              className="w-full h-auto object-cover"
            />
            {product.compareAtPrice && (
              <span className="absolute top-5 left-5 bg-[#8bb56e] text-white text-[11px] font-mono tracking-widest uppercase font-bold px-3 py-1.5 rounded-full">
                Save {formatINR(product.compareAtPrice - product.price)}
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
              {product.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] mb-4">{product.name}</h1>

            {/* Rating */}
            {rating.count > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex gap-0.5 text-[#4a7333] text-sm" aria-label={`Rated ${rating.average} out of 5 stars`}>
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
                Coming Soon — arriving with the next harvest
              </p>
            ) : (
              <div className="flex items-baseline gap-3 mb-6">
                {product.compareAtPrice && (
                  <span className="text-[#4a584a] text-lg line-through">{formatINR(product.compareAtPrice)}</span>
                )}
                <span className="text-3xl font-bold">{formatINR(activeVariant.price)}</span>
                <span className="text-xs font-mono text-[#4a584a]">/ {activeVariant.size}</span>
              </div>
            )}

            <p className="text-sm text-[#4a584a] leading-relaxed mb-6">{product.description}</p>
            {product.longDescription && (
              <p className="text-xs text-[#4a584a] leading-relaxed mb-8">{product.longDescription}</p>
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

            {/* Qty + CTA */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              {!comingSoon && (
                <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-4 py-3 sm:w-32 bg-white">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="text-[#1b261b] hover:text-[#4a7333] font-bold text-lg leading-none transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -my-2"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="font-mono text-sm font-semibold select-none">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(q + 1, activeVariant.stock))}
                    className="text-[#1b261b] hover:text-[#4a7333] font-bold text-lg leading-none transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center -my-2"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
              )}
              <button
                onClick={handleAddToCart}
                disabled={isAdding || isAdded || !variantInStock || comingSoon}
                className={`flex-grow text-xs font-bold tracking-widest uppercase py-4 px-8 rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${!variantInStock || comingSoon
                    ? 'bg-[#1b261b]/10 text-[#4a584a] cursor-not-allowed'
                    : isAdded ? 'bg-[#8bb56e] text-white' : isAdding ? 'bg-[#1b261b]/50 text-white/50 cursor-wait' : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
                  }`}
              >
                {comingSoon ? 'Coming Soon' : !variantInStock ? 'Sold Out' : isAdding ? 'Adding...' : isAdded ? 'Added ✓' : `Add to Cart • ${formatINR(activeVariant.price * quantity)}`}
              </button>
            </div>

            {/* Trust microcopy */}
            <ul className="space-y-2 text-xs text-[#4a584a]">
              <li className="flex items-center gap-2">
                <span className="text-[#4a7333]">✓</span> Free shipping on orders of {formatINR(FREE_SHIPPING_THRESHOLD)} or more
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#4a7333]">✓</span> The Elegant Sip Promise  30-day satisfaction guarantee
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#4a7333]">✓</span> Packed within weeks of harvest, dated on every pack
              </li>
            </ul>
          </div>
        </div>

        {/* Details: Origin + Flavor + Brewing */}
        <ProductInfoCards product={product} garden={garden} />

        {/* Reviews */}
        <ProductReviews
          productId={product.id}
          reviews={reviews}
          rating={rating}
          onAdded={(entry) => setLocalReviews((prev) => [entry, ...prev])}
        />

        {/* Related */}
        {related.length > 0 && (
          <div>
            <div className="text-center mb-10">
              <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Continue the Journey</span>
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">You May Also Love</h2>
            </div>
            <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-4 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-3 md:gap-8">
              {related.map((item) => (
                <div key={item.id} className="min-w-[80vw] sm:min-w-[46vw] md:min-w-0 snap-center flex">
                  <ProductCard product={item} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
