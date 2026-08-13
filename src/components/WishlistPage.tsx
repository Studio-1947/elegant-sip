import { useCart } from './CartContext'
import { getProduct } from '../data/products'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'

export default function WishlistPage() {
  const { wishlist, toggleWishlist, addToCart } = useCart()
  useDocumentMeta('Your Wishlist — Elegant Sip', 'Your saved Elegant Sip teas.')

  const items = wishlist
    .map((id) => getProduct(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        <Link to="/" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors mb-6 inline-block">
          ← Back to Experience
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mb-3">Your Wishlist</h1>
        <p className="text-xs text-[#4a584a] mb-12">
          {items.length === 0
            ? 'Saved teas will appear here — tap the heart on any product.'
            : `${items.length} ${items.length === 1 ? 'tea' : 'teas'} saved for later.`}
        </p>

        {items.length === 0 ? (
          <div className="max-w-md mx-auto text-center py-20 px-6 bg-white border border-[#1b261b]/10 rounded-2xl shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
            <svg className="w-14 h-14 text-[#8bb56e]/40 mx-auto mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <h2 className="text-xl font-bold mb-3">Nothing saved yet</h2>
            <p className="text-xs text-[#4a584a] leading-relaxed mb-8">
              Tap the heart on any tea to keep it here for later.
            </p>
            <Link to="/shop" className="block w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 rounded-lg transition-colors text-center">
              Explore the Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-5 p-4 md:p-5 bg-white border border-[#1b261b]/10 rounded-2xl shadow-[0_4px_20px_rgba(27,38,27,0.02)]"
              >
                <Link to={`/product/${item.id}`} className="flex-shrink-0">
                  <div className="w-20 h-24 rounded-xl overflow-hidden bg-[#fdfdfd] border border-[#1b261b]/5">
                    <img src={item.imageSrc} alt={item.name} className="w-full h-full object-cover" />
                  </div>
                </Link>
                <div className="flex-grow">
                  <Link to={`/product/${item.id}`} className="hover:text-[#8bb56e] transition-colors">
                    <h3 className="text-base md:text-lg font-bold">{item.name}</h3>
                  </Link>
                  <p className="text-xs text-[#4a584a] mt-0.5">{item.category}</p>
                  <p className="text-sm font-bold mt-1.5">${item.price}.00</p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      addToCart({ id: item.id, name: item.name, price: item.price, imageSrc: item.imageSrc }, 1)
                      track('add_to_cart', { product: item.id, source: 'wishlist' })
                    }}
                    className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-[10px] font-bold tracking-widest uppercase py-2.5 px-5 rounded-lg transition-colors cursor-pointer"
                  >
                    Add to Cart
                  </button>
                  <button
                    onClick={() => toggleWishlist(item.id)}
                    className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a] hover:text-red-600 transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
