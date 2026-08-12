import { useCart } from './CartContext'

interface CartPageProps {
  onBackToHome: () => void
}

export default function CartPage({ onBackToHome }: CartPageProps) {
  const { cart, updateQuantity, removeFromCart, cartTotal } = useCart()

  const shippingFee = cartTotal > 50 ? 0 : 5.00
  const estimatedTax = cartTotal * 0.08
  const finalTotal = cartTotal + shippingFee + estimatedTax

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      {/* Back button & Header */}
      <div className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <button 
            onClick={onBackToHome}
            className="group flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors mb-4 focus:outline-none cursor-pointer"
          >
            <span className="transition-transform duration-300 group-hover:-translate-x-1">←</span> Back to Experience
          </button>
          <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">Your Cart</h1>
        </div>
        <p className="text-xs font-mono text-[#8bb56e] uppercase tracking-[0.2em] border border-[#8bb56e]/20 rounded-full px-4 py-2 bg-[#8bb56e]/5 self-start md:self-auto">
          Secure Checkout
        </p>
      </div>

      {cart.length === 0 ? (
        <div className="max-w-md mx-auto text-center py-20 px-6 bg-white border border-[#1b261b]/10 rounded-2xl shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <svg viewBox="0 0 24 24" className="w-16 h-16 text-[#8bb56e]/40 mx-auto mb-6" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
          <h2 className="text-xl font-bold mb-3">Your cup is empty</h2>
          <p className="text-xs text-[#4a584a] leading-relaxed mb-8">
            Explore our collections and select from the finest single-origin tea gardens.
          </p>
          <button 
            onClick={onBackToHome}
            className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
          >
            Explore Collections
          </button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-6">
            {cart.map((item) => (
              <div 
                key={item.id}
                className="flex items-center gap-6 p-4 md:p-6 bg-white border border-[#1b261b]/10 rounded-2xl shadow-[0_4px_20px_rgba(27,38,27,0.02)]"
              >
                {/* Image */}
                <div className="w-20 h-24 md:w-24 md:h-30 rounded-xl overflow-hidden bg-[#fdfdfd] border border-[#1b261b]/5 flex-shrink-0">
                  <img 
                    src={item.imageSrc} 
                    alt={item.name} 
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Details */}
                <div className="flex-grow flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base md:text-lg font-bold">{item.name}</h3>
                    <p className="text-xs text-[#4a584a] mt-1">${item.price}.00 per pack</p>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-xs font-mono tracking-wider text-red-600 hover:text-red-700 transition-colors mt-3 block focus:outline-none cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Quantity & Price */}
                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-3 py-1.5 w-24 bg-[#f9faf7]">
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-sm leading-none transition-colors"
                      >
                        −
                      </button>
                      <span className="text-[#1b261b] font-mono text-xs font-semibold select-none">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-sm leading-none transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-base md:text-lg font-bold min-w-[70px] text-right">
                      ${item.price * item.quantity}.00
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(27,38,27,0.04)] lg:sticky lg:top-28">
            <h2 className="text-lg font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-6">
              Order Summary
            </h2>
            
            <div className="space-y-4 text-xs">
              <div className="flex justify-between text-[#4a584a]">
                <span>Subtotal</span>
                <span className="font-mono">${cartTotal}.00</span>
              </div>
              <div className="flex justify-between text-[#4a584a]">
                <span>Shipping</span>
                <span className="font-mono">
                  {shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-[#4a584a]">
                <span>Estimated Tax (8%)</span>
                <span className="font-mono">${estimatedTax.toFixed(2)}</span>
              </div>
              
              {shippingFee > 0 && (
                <p className="text-[10px] text-[#8bb56e] font-mono italic">
                  Spend ${(50 - cartTotal).toFixed(0)} more for Free Shipping
                </p>
              )}

              <div className="border-t border-[#1b261b]/10 pt-4 mt-4 flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="font-mono">${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <button 
              onClick={() => alert('Thank you for your purchase! Checkout flow coming soon.')}
              className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-4 rounded-lg transition-colors mt-8 active:scale-[0.98] cursor-pointer"
            >
              Proceed to Checkout
            </button>

            <button 
              onClick={onBackToHome}
              className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all mt-3 active:scale-[0.98] cursor-pointer"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
