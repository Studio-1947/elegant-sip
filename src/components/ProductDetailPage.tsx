import { useEffect, useState } from 'react'
import { getProduct, getReviews, getDefaultVariant, getGardenByEstate, PRODUCTS, type Review } from '../data/products'
import { Link, useDocumentMeta, useJsonLd } from '../lib/router'
import { useCart } from './CartContext'
import { track } from '../lib/analytics'
import { getLocalReviews, addLocalReview } from '../lib/localReviews'
import { hasPurchased } from '../lib/orders'
import { formatINR } from '../lib/currency'
import { FREE_SHIPPING_THRESHOLD } from '../lib/pricing'
import ProductCard from './ProductCard'

export default function ProductDetailPage({ id }: { id?: string }) {
  const product = getProduct(id)
  const [quantity, setQuantity] = useState(1)
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)
  const [localReviews, setLocalReviews] = useState<Review[]>([])
  const [reviewForm, setReviewForm] = useState({ author: '', rating: 5, text: '' })
  const [reviewOpen, setReviewOpen] = useState(false)
  const { addToCart } = useCart()

  // Reset per-product state when navigating between products (same component instance)
  useEffect(() => {
    setQuantity(1)
    setSelectedSize(null)
    setIsAdding(false)
    setIsAdded(false)
    setReviewOpen(false)
    setReviewForm({ author: '', rating: 5, text: '' })
    setLocalReviews(id ? getLocalReviews(id) : [])
  }, [id])

  const variant = product
    ? product.variants.find((v) => v.size === selectedSize) ?? getDefaultVariant(product)
    : undefined
  const variantInStock = (variant?.stock ?? 0) > 0
  const comingSoon = product?.status === 'coming-soon'

  useDocumentMeta(
    product ? `${product.name} — Elegant Sip` : 'Product not found — Elegant Sip',
    product ? product.description : undefined,
  )
  useJsonLd(
    product && variant
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: product.imageSrc,
          // Coming-soon items have no price yet — declaring a ₹0 offer would be wrong.
          ...(product.status !== 'coming-soon'
            ? {
                offers: product.variants.map((v) => ({
                  '@type': 'Offer',
                  priceCurrency: 'INR',
                  price: v.price,
                  name: v.size,
                  availability: v.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
                })),
              }
            : {}),
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

  const reviews = [...localReviews, ...getReviews(product.id)]
  const rating =
    reviews.length === 0
      ? { average: 0, count: 0 }
      : {
          average: Math.round((reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length) * 10) / 10,
          count: reviews.length,
        }
  // Prefer same-category teas, fill from the rest of the catalogue.
  const related = [
    ...PRODUCTS.filter((p) => p.id !== product.id && p.category === product.category),
    ...PRODUCTS.filter((p) => p.id !== product.id && p.category !== product.category),
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

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reviewForm.author.trim() || !reviewForm.text.trim()) return
    const entry = addLocalReview(product.id, {
      author: reviewForm.author.trim(),
      rating: reviewForm.rating,
      text: reviewForm.text.trim(),
      verified: hasPurchased(product.id),
    })
    setLocalReviews((prev) => [entry, ...prev])
    setReviewForm({ author: '', rating: 5, text: '' })
    setReviewOpen(false)
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
                Save {formatINR(product.compareAtPrice - product.price)}
              </span>
            )}
          </div>

          {/* Info */}
          <div>
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
              {product.category}
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

            {comingSoon ? (
              <p className="inline-block bg-[#8bb56e]/10 border border-[#8bb56e]/30 rounded-lg px-4 py-2.5 text-[#8bb56e] text-xs font-mono font-bold tracking-widest uppercase mb-6">
                Coming Soon — arriving with the next harvest
              </p>
            ) : (
              <div className="flex items-baseline gap-3 mb-6">
                {product.compareAtPrice && (
                  <span className="text-[#4a584a]/50 text-lg line-through">{formatINR(product.compareAtPrice)}</span>
                )}
                <span className="text-3xl font-bold">{formatINR(activeVariant.price)}</span>
                <span className="text-xs font-mono text-[#4a584a]">/ {activeVariant.size}</span>
              </div>
            )}

            <p className="text-sm text-[#4a584a] leading-relaxed mb-6">{product.description}</p>
            <p className="text-xs text-[#4a584a]/80 leading-relaxed mb-8">{product.longDescription}</p>

            {/* Size picker */}
            {product.variants.length > 1 && (
              <div className="mb-6">
                <span className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-2.5">Size</span>
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
                        className={`px-4 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                          soldOut
                            ? 'border-[#1b261b]/10 text-[#4a584a]/40 line-through cursor-not-allowed bg-[#f9faf7]'
                            : selected
                            ? 'border-[#1b261b] bg-[#1b261b] text-white'
                            : 'border-[#1b261b]/20 bg-white text-[#1b261b] hover:border-[#8bb56e]'
                        }`}
                      >
                        {v.size} · {formatINR(v.price)}
                        {soldOut && <span className="no-underline ml-1.5 text-[9px] font-mono uppercase">Sold out</span>}
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
                  className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span className="font-mono text-sm font-semibold select-none">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(q + 1, activeVariant.stock))}
                  className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              )}
              <button
                onClick={handleAddToCart}
                disabled={isAdding || isAdded || !variantInStock || comingSoon}
                className={`flex-grow text-xs font-bold tracking-widest uppercase py-4 px-8 rounded-lg transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                  !variantInStock || comingSoon
                    ? 'bg-[#1b261b]/10 text-[#4a584a]/60 cursor-not-allowed'
                    : isAdded ? 'bg-[#8bb56e] text-white' : isAdding ? 'bg-[#1b261b]/50 text-white/50 cursor-wait' : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
                }`}
              >
                {comingSoon ? 'Coming Soon' : !variantInStock ? 'Sold Out' : isAdding ? 'Adding...' : isAdded ? 'Added ✓' : `Add to Cart • ${formatINR(activeVariant.price * quantity)}`}
              </button>
            </div>

            {/* Trust microcopy */}
            <ul className="space-y-2 text-xs text-[#4a584a]">
              <li className="flex items-center gap-2">
                <span className="text-[#8bb56e]">✓</span> Free shipping on orders of {formatINR(FREE_SHIPPING_THRESHOLD)} or more
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
                    <dd className="font-medium text-right">
                      {label === 'Estate' && garden ? (
                        <Link to="/gardens" className="underline decoration-[#8bb56e]/50 underline-offset-2 hover:text-[#8bb56e] transition-colors">
                          {value}
                        </Link>
                      ) : (
                        value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {garden && (
                <Link to="/gardens" className="inline-block mt-4 text-[10px] font-mono tracking-widest uppercase text-[#8bb56e] hover:text-[#1b261b] transition-colors">
                  Visit the garden →
                </Link>
              )}
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
            <button
              onClick={() => setReviewOpen((o) => !o)}
              className="self-start md:self-auto border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-white text-[#1b261b] text-[10px] font-bold tracking-widest uppercase py-3 px-6 rounded-lg transition-all cursor-pointer"
            >
              {reviewOpen ? 'Cancel' : 'Write a Review'}
            </button>
          </div>

          {reviewOpen && (
            <form onSubmit={handleReviewSubmit} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-8 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="rv-name" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Your name</label>
                  <input
                    id="rv-name"
                    type="text"
                    required
                    value={reviewForm.author}
                    onChange={(e) => setReviewForm((f) => ({ ...f, author: e.target.value }))}
                    className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Rating</span>
                  <div className="flex gap-1 items-center h-[46px]" role="radiogroup" aria-label="Rating">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={reviewForm.rating === n}
                        aria-label={`${n} star${n > 1 ? 's' : ''}`}
                        onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                        className="cursor-pointer"
                      >
                        <svg className="w-6 h-6" viewBox="0 0 20 20" fill={n <= reviewForm.rating ? '#8bb56e' : 'none'} stroke="#8bb56e" strokeWidth="1.2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 15l-5.3 2.6 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="rv-text" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Your review</label>
                <textarea
                  id="rv-text"
                  required
                  rows={4}
                  value={reviewForm.text}
                  onChange={(e) => setReviewForm((f) => ({ ...f, text: e.target.value }))}
                  placeholder="How does it taste? How did you brew it?"
                  className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors resize-none placeholder:text-[#1b261b]/25"
                />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-[10px] font-mono text-[#4a584a]/60">
                  Demo store: reviews are saved in this browser. "Verified purchase" appears only if you've ordered this tea here.
                </p>
                <button
                  type="submit"
                  className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  Submit Review
                </button>
              </div>
            </form>
          )}

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
