import { type CartItem } from '../CartContext'
import { TAX_RATE } from '../../lib/pricing'
import { formatINR } from '../../lib/currency'

interface CheckoutSummaryProps {
  cart: CartItem[]
  subtotal: number
  discount: number
  coupon: string | null
  shippingFee: number
  estimatedTax: number
  finalTotal: number
}

/** Sticky order-summary sidebar on the checkout page. */
export default function CheckoutSummary({ cart, subtotal, discount, coupon, shippingFee, estimatedTax, finalTotal }: CheckoutSummaryProps) {
  return (
    <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(27,38,27,0.04)] lg:sticky lg:top-28">
      <h2 className="text-lg font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-6">Order Summary</h2>
      <div className="space-y-3 text-xs mb-6">
        {cart.map((item) => (
          <div key={`${item.productSlug}__${item.size}`} className="flex justify-between gap-3">
            <span className="text-[#4a584a]">{item.name} <span className="text-[#4a584a]">({item.size}) × {item.quantity}</span></span>
            <span className="font-mono font-semibold">{formatINR(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 text-xs border-t border-[#1b261b]/10 pt-4">
        <div className="flex justify-between text-[#4a584a]">
          <span>Subtotal</span>
          <span className="font-mono">{formatINR(subtotal)}</span>
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
        <div className="border-t border-[#1b261b]/10 pt-3 mt-3 flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="font-mono">{formatINR(finalTotal)}</span>
        </div>
      </div>
      <p className="text-[11px] font-mono text-[#4a7333] italic mt-4 flex items-center gap-1.5">
        <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
        No payment is taken on this page.
      </p>
    </div>
  )
}
