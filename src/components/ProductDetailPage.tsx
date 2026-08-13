import { useState } from 'react'
import { getProduct, getProduct as findProduct, getReviews, getRating, PRODUCTS } from '../data/products'
import { Link, useDocumentMeta, useJsonLd } from '../lib/router'
import { useCart } from './CartContext'
import { track } from '../lib/analytics'
import ProductCard from './ProductCard'

export default function ProductDetailPage({ id }: { id?: string }) {
  const product = getProduct(id)
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const { addToCart } = useCart()

  useDocumentMeta(
    product ? `${product.name} — Elegant Sip` : 'Product not found — Elegant Sip',
    product ? product.description : undefined,
  )
  useJsonLd(
    product
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.imageSrc,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: product.price,
            availability: 'https://schema.org/InStock',
          },
          ...(product.origin
            ? {
                additionalProperty: [
                  { '@type': 'PropertyValue', name: 'Origin', value: product.origin.origin },
                  { '@type': 'PropertyValue', name: 'Estate', value: product.origin.estate },
                  { '@type': 'PropertyValue', name: 'Harvest', value: product.origin.harvest },
                ],
              }
            : {}),
        }
      : null,
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

  const rating = getRating(product.id)
  const reviews = getReviews(product.id)
  const related = PRODUCTS.filter((p) => p.id !== product.id).slice(0, 3)

  const handleAddToCart = () => {
    setIsAdding(true)
    addToCart({ id: product.id, name: product.name, price: product.price, imageSrc: product.imageSrc }, quantity)
    track('add_to_cart', { product: product.id, quantity, source: 'product_detail' })
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setTimeout(() => setIsAdded(false), 2000)
    }, 800)
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <Link to="/shop" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors">
            ← Back to Collection
          </Link>
        </nav>

        {/* Hero grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start mb-24">
          {/* Image */}
          <div className="relative rounded-2xl overflow-hidden border border-[#1b261b]/10 bg-white shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
            <img src={product.imageSrc} alt={product.name} className="w-full h-auto object-cover" />
            {product.compareAtPrice && (
              <span className="absolute top-5 left-5 bg-[#8bb56e] text-white text-[10px] font-mono tracking-widest uppercase font-bold px-3 py-1.5 rounded-full">
                Save ${product.compareAtPrice - product.price}
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
              {product.isBundle ? 'Curated Collection' : product.category}
            </span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight leading-[1.05] mb-4">{product.name}</h1>

            {/* Rating */}
            {rating.count > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex gap-0.5 text-[#8bb56e] text-sm" aria-label={`Rated ${rating.average} out of 5 stars`}>
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4" viewBox="0 0 20 20" fill={i < Math.round(rating.average) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                    </svg>
                  ))}
                </div>
                <span className="text-xs font-mono text-[#4a584a]">{rating.average} · {rating.count} reviews</span>
              </div>
            )}

            <div className="flex items-baseline gap-3 mb-6">
              {product.compareAtPrice && (
                <span className="text-[#4a584a]/50 text-lg line-through">${product.compareAtPrice}.00</span>
              )}
              <span className="text-3xl font-bold">${product.price}.00</span>
            </div>

            <p className="text-sm text-[#4a584a] leading-relaxed mb-6">{product.description}</p>
            <p className="text-xs text-[#4a584a]/80 leading-relaxed mb-8">{product.longDescription}</p>

            {product.isBundle && product.contains && (
              <div className="bg-white border border-[#1b261b]/10 rounded-xl p-4 mb-8">
                <span className="text-[10px] font-mono tracking-widest uppercase text-[#8bb56e] block mb-2">This collection includes</span>
                <div className="space-y-1.5">
                  {product.contains.map((cid) => {
                    const item = findProduct(cid)
                    return item ? (
                      <Link key={cid} to={`/product/${item.id}`} className="flex justify-between items-center text-xs group">
                        <span className="group-hover:text-[#8bb56e] transition-colors">{item.name}</span>
                        <span className="text-[#4a584a]">${item.price}.00</span>
                      </Link>
                    ) : null
                  })}
                </div>
              </div>
            )}

            {/* Qty + CTA */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-4 py-3 sm:w-32 bg-white">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="font-mono text-sm font-semibold select-none">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => q + 1)}
                  className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                disabled={isAdding || isAdded}
                className={`flex-grow text-xs font-bold tracking-widest uppercase py-4 px-8 rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                  isAdded ? 'bg-[#8bb56e] text-white' : isAdding ? 'bg-[#1b261b]/50 text-white/50 cursor-wait' : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
                }`}
              >
                {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : `Add to Cart • $${product.price * quantity}.00`}
              </button>
            </div>

            {/* Trust microcopy */}
            <ul className="space-y-2 text-xs text-[#4a584a]">
              <li className="flex items-center gap-2">
                <span className="text-[#8bb56e]">✓</span> Free shipping on orders over $50
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8bb56e]">✓</span> The Elegant Sip Promise — 30-day satisfaction guarantee
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#8bb56e]">✓</span> Packed within weeks of harvest, dated on every tin
              </li>
            </ul>
          </div>
        </div>

        {/* Details: Origin + Flavor + Brewing */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          {product.origin && (
            <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Tea Origin</span>
              <dl className="space-y-2 text-xs">
                {(
                  [
                    ['Origin', product.origin.origin],
                    ['Estate', product.origin.estate],
                    ['Elevation', product.origin.elevation],
                    ['Harvest', product.origin.harvest],
                    ['Cultivar', product.origin.cultivar],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[#4a584a]">{label}</dt>
                    <dd className="font-medium text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {product.flavorProfile && (
            <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Flavor Profile</span>
              <div className="space-y-3 text-xs">
                {(
                  [
                    ['Strength', product.flavorProfile.strength],
                    ['Astringency', product.flavorProfile.astringency],
                    ['Sweetness', product.flavorProfile.sweetness],
                    ['Floral', product.flavorProfile.floral],
                    ['Caffeine', product.flavorProfile.caffeine],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#4a584a]">{label}</span>
                      <span className="font-mono">{value}/5</span>
                    </div>
                    <div className="h-1 bg-[#1b261b]/5 rounded-full overflow-hidden">
                      <div className="h-full bg-[#8bb56e] rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {product.brewingGuide && (
            <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <span className="text-[#8bb56e] text-[10px] font-mono tracking-wider uppercase block border-b border-[#1b261b]/10 pb-2 mb-4">Brewing Guide</span>
              <dl className="space-y-2 text-xs">
                {[
                  ['Temperature', product.brewingGuide.temperature],
                  ['Steep time', product.brewingGuide.time],
                  ['Steeps', product.brewingGuide.steeps],
                  ['Leaf', product.brewingGuide.leafAmount],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4">
                    <dt className="text-[#4a584a]">{label}</dt>
                    <dd className="font-medium text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[11px] text-[#4a584a] italic mt-4 leading-relaxed">{product.brewingGuide.notes}</p>
            </div>
          )}
        </div>

        {/* Reviews */}
        <div className="mb-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Customer Reviews</span>
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">
                {rating.count > 0 ? `${rating.average} / 5 from ${rating.count} reviews` : 'Reviews'}
              </h2>
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="text-sm text-[#4a584a] bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              No reviews yet for this tea. Be the first to tell us how it tastes.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map((review) => (
                <div key={review.id} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-0.5 text-[#8bb56e] text-xs">
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} className="w-3.5 h-3.5" viewBox="0 0 20 20" fill={i < review.rating ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-[#4a584a]/60">{review.date}</span>
                  </div>
                  <p className="text-xs text-[#4a584a] leading-relaxed mb-4">{review.text}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold">{review.author}</span>
                    {review.verified && (
                      <span className="text-[9px] font-mono uppercase tracking-wider bg-[#8bb56e]/10 text-[#8bb56e] px-2 py-0.5 rounded-full">Verified</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div>
            <div className="text-center mb-10">
              <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Continue the Journey</span>
              <h2 className="text-2xl md:text-3xl font-bold uppercase tracking-tight">You May Also Love</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
