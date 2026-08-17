import { useEffect, useState } from 'react'
import { useCart } from './CartContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, TAX_RATE } from '../lib/pricing'

export default function CartPage() {
  const { cart, updateQuantity, removeFromCart, cartTotal, discount, coupon, applyCoupon, removeCoupon } = useCart()
  const [couponInput, setCouponInput] = useState('')
  const [couponError, setCouponError] = useState<string | null>(null)
  // Notes are persisted so checkout can attach them to the placed order.
  const [orderNotes, setOrderNotes] = useState(() => localStorage.getItem('elegant_sip_order_notes') || '')

  useEffect(() => {
    localStorage.setItem('elegant_sip_order_notes', orderNotes)
  }, [orderNotes])

  useDocumentMeta('Your Cart — Elegant Sip', 'Review your Elegant Sip order.')

  const { shippingFee, estimatedTax, finalTotal, amountToFreeShipping } = getOrderPricing(cartTotal, discount)

  const handleApplyCoupon = () => {
    if (applyCoupon(couponInput)) {
      setCouponError(null)
      setCouponInput('')
    } else {
      setCouponError('That code isn’t valid. Try SIP10 for 10% off.')
    }
  }

  const handleRemove = (id: string, size: string) => {
    removeFromCart(id, size)
    track('remove_from_cart', { product: id })
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      {/* Back button & Header */}
      <div className="max-w-6xl mx-auto mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <Link to="/" className="group flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors mb-4">
            <span className="transition-transform duration-300 group-hover:-translate-x-1">←</span> Back to Experience
          </Link>
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
          <Link to="/shop" className="block w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 rounded-lg transition-colors">
            Explore Collections
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-6">
            {cart.map((item) => (
              <div
                key={`${item.id}__${item.size}`}
                className="flex items-center gap-6 p-4 md:p-6 bg-white border border-[#1b261b]/10 rounded-2xl shadow-[0_4px_20px_rgba(27,38,27,0.02)]"
              >
                <Link to={`/product/${item.id}`} className="flex-shrink-0">
                  <div className="w-20 h-24 md:w-24 md:h-30 rounded-xl overflow-hidden bg-[#fdfdfd] border border-[#1b261b]/5">
                    <img
                      src={item.imageSrc}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </Link>

                {/* Details */}
                <div className="flex-grow flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <Link to={`/product/${item.id}`} className="hover:text-[#8bb56e] transition-colors">
                      <h3 className="text-base md:text-lg font-bold">{item.name}</h3>
                    </Link>
                    <p className="text-xs text-[#4a584a] mt-1">{item.size} · ${item.price}.00 each</p>
                    <button
                      onClick={() => handleRemove(item.id, item.size)}
                      className="text-xs font-mono tracking-wider text-red-600 hover:text-red-700 transition-colors mt-3 block focus:outline-none cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Quantity & Price */}
                  <div className="flex items-center gap-6 justify-between md:justify-end">
                    <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-3 py-1.5 w-24 bg-[#f9faf7]">
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                        className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-sm leading-none transition-colors"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </button>
                      <span className="text-[#1b261b] font-mono text-xs font-semibold select-none">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                        className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-sm leading-none transition-colors"
                        aria-label={`Increase quantity of ${item.name}`}
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

            {/* Order Notes */}
            <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <label htmlFor="order-notes" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-2">
                Order Notes (optional)
              </label>
              <textarea
                id="order-notes"
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                rows={3}
                placeholder="Gift message, delivery instructions, or a note for our tea master…"
                className="w-full bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25 resize-none"
              />
            </div>
          </div>

          {/* Order Summary */}
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(27,38,27,0.04)] lg:sticky lg:top-28">
            <h2 className="text-lg font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-6">
              Order Summary
            </h2>

            {/* Coupon */}
            <div className="mb-6">
              <label htmlFor="coupon" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-2">
                Promo Code
              </label>
              {coupon ? (
                <div className="flex items-center justify-between bg-[#8bb56e]/5 border border-[#8bb56e]/30 rounded-lg px-4 py-2.5">
                  <span className="text-xs font-mono font-bold text-[#8bb56e]">{coupon} applied</span>
                  <button onClick={removeCoupon} className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a] hover:text-red-600 transition-colors cursor-pointer">
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    id="coupon"
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Try SIP10"
                    className="flex-grow bg-[#f9faf7] border border-[#1b261b]/15 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25 uppercase"
                  />
                  <button
                    onClick={handleApplyCoupon}
                    className="border border-[#1b261b]/20 hover:border-[#1b261b] text-[#1b261b] text-[10px] font-bold tracking-widest uppercase px-4 rounded-lg transition-all cursor-pointer"
                  >
                    Apply
                  </button>
                </div>
              )}
              {couponError && <p className="text-[11px] text-red-600 mt-1.5">{couponError}</p>}
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex justify-between text-[#4a584a]">
                <span>Subtotal</span>
                <span className="font-mono">${cartTotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#8bb56e]">
                  <span>Discount ({coupon})</span>
                  <span className="font-mono">−${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#4a584a]">
                <span>Shipping</span>
                <span className="font-mono">
                  {shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-[#4a584a]">
                <span>Estimated Tax ({Math.round(TAX_RATE * 100)}%)</span>
                <span className="font-mono">${estimatedTax.toFixed(2)}</span>
              </div>

              {shippingFee > 0 && (
                <p className="text-[10px] text-[#8bb56e] font-mono italic">
                  Spend ${amountToFreeShipping.toFixed(2)} more for Free Shipping
                </p>
              )}

              <div className="border-t border-[#1b261b]/10 pt-4 mt-4 flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="font-mono">${finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <Link
              to="/checkout"
              onClick={() => track('begin_checkout', { step: 1 })}
              className="block w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-4 rounded-lg transition-colors mt-8 text-center active:scale-[0.98]"
            >
              Proceed to Checkout
            </Link>

            <Link
              to="/shop"
              className="block w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all mt-3 text-center active:scale-[0.98]"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
