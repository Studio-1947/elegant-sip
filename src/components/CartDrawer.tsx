import { useEffect } from 'react'
import { useCart } from './CartContext'
import { Link } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, TAX_RATE } from '../lib/pricing'
import { formatINR } from '../lib/currency'
import { useDialog } from '../lib/useDialog'

interface CartDrawerProps {
  isOpen: boolean
  onClose: () => void
}

/**
 * Right-side cart drawer (phones): quick item management + totals + checkout.
 * The full /cart page remains for desktop, coupons, and order notes.
 */
export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { cart, cartCount, updateQuantity, removeFromCart, cartTotal, discount, coupon } = useCart()
  const { shippingFee, estimatedTax, finalTotal, amountToFreeShipping } = getOrderPricing(cartTotal, discount)

  // Focus trap, focus restoration, Escape and scroll lock.
  const dialogRef = useDialog(isOpen, onClose)

  // Close on navigation.
  useEffect(() => {
    if (!isOpen) return
    window.addEventListener('popstate', onClose)
    window.addEventListener('elegantsip:route', onClose)
    return () => {
      window.removeEventListener('popstate', onClose)
      window.removeEventListener('elegantsip:route', onClose)
    }
  }, [isOpen, onClose])

  const handleRemove = (id: string, size: string) => {
    removeFromCart(id, size)
    track('remove_from_cart', { product: id })
  }

  return (
    // `inert` removes the closed drawer's ~10 controls from the tab order and
    // the accessibility tree entirely. `aria-hidden` alone left them focusable,
    // which is an explicit ARIA violation.
    <div
      ref={dialogRef}
      className={`fixed inset-0 z-50 ${isOpen ? '' : 'pointer-events-none'}`}
      aria-hidden={!isOpen}
      inert={!isOpen}
    >
      {/* Scrim */}
      <div
        className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={`absolute right-0 top-0 h-full w-[86vw] max-w-sm bg-[#f9faf7] text-[#1b261b] shadow-[-12px_0_40px_rgba(27,38,27,0.18)] flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1b261b]/10 bg-white">
          <h2 id="cart-drawer-title" className="text-sm font-bold uppercase tracking-wide">
            Your Cart {cartCount > 0 && <span className="text-[#4a7333]">({cartCount})</span>}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 text-[#1b261b] hover:text-[#4a7333] transition-colors cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <svg viewBox="0 0 24 24" className="w-14 h-14 text-[#4a7333]/40 mb-5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <h3 className="text-lg font-bold mb-2">Your cup is empty</h3>
            <p className="text-xs text-[#4a584a] leading-relaxed mb-6">
              Explore the collection and pick a leaf you'll love.
            </p>
            <Link
              to="/shop"
              onClick={onClose}
              className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 rounded-lg transition-colors text-center"
            >
              Explore Collections
            </Link>
          </div>
        ) : (
          <>
            {/* Items */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              {cart.map((item) => (
                <div key={`${item.id}__${item.size}`} className="flex gap-3.5 bg-white border border-[#1b261b]/10 rounded-xl p-3">
                  <Link to={`/product/${item.id}`} onClick={onClose} className="flex-shrink-0">
                    <img
                      src={item.imageSrc}
                      alt={item.name}
                      loading="lazy"
                      width={64}
                      height={80}
                      className="w-16 h-20 object-cover rounded-lg border border-[#1b261b]/5 bg-[#fdfdfd]"
                    />
                  </Link>
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link to={`/product/${item.id}`} onClick={onClose} className="text-sm font-bold leading-snug hover:text-[#4a7333] transition-colors">
                        {item.name}
                      </Link>
                      <span className="text-sm font-bold whitespace-nowrap">{formatINR(item.price * item.quantity)}</span>
                    </div>
                    <p className="text-[11px] text-[#4a584a] mt-0.5 truncate">{item.size}</p>
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-3 border border-[#1b261b]/20 rounded-lg px-2.5 py-1 bg-[#f9faf7]">
                        <button
                          onClick={() => updateQuantity(item.id, item.size, item.quantity - 1)}
                          className="text-[#1b261b] hover:text-[#4a7333] font-bold text-base leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -my-2 cursor-pointer"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          −
                        </button>
                        <span className="font-mono text-xs font-semibold select-none">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.size, item.quantity + 1)}
                          className="text-[#1b261b] hover:text-[#4a7333] font-bold text-base leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -my-2 cursor-pointer"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => handleRemove(item.id, item.size)}
                        className="text-[11px] font-mono tracking-wider uppercase text-red-700 hover:text-red-800 transition-colors min-h-[44px] px-2 -mx-2 cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary + actions */}
            <div className="border-t border-[#1b261b]/10 bg-white px-5 py-4">
              {shippingFee > 0 && (
                <p className="text-[11px] text-[#4a7333] font-mono italic mb-3">
                  Spend {formatINR(amountToFreeShipping)} more for Free Shipping
                </p>
              )}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-[#4a584a]">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatINR(cartTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-[#4a7333]">
                    <span>Discount ({coupon})</span>
                    <span className="font-mono">−{formatINR(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[#4a584a]">
                  <span>Shipping</span>
                  <span className="font-mono">{shippingFee === 0 ? 'Free' : formatINR(shippingFee)}</span>
                </div>
                <div className="flex justify-between text-[#4a584a]">
                  <span>GST ({Math.round(TAX_RATE * 100)}%)</span>
                  <span className="font-mono">{formatINR(estimatedTax)}</span>
                </div>
                <div className="border-t border-[#1b261b]/10 pt-2 mt-2 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="font-mono">{formatINR(finalTotal)}</span>
                </div>
              </div>
              <Link
                to="/checkout"
                onClick={() => {
                  track('begin_checkout', { step: 1 })
                  onClose()
                }}
                className="block w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors mt-4 text-center active:scale-[0.98]"
              >
                Proceed to Checkout
              </Link>
              <Link
                to="/cart"
                onClick={onClose}
                className="block w-full text-center text-[11px] font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#4a7333] transition-colors mt-3"
              >
                View full cart · coupons & notes
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
