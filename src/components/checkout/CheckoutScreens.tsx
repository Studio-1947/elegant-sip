import { Link } from '../../lib/router'

/** Post-purchase confirmation screen — the order is saved to this device only. */
export function OrderConfirmedScreen({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
      <div className="max-w-lg mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#8bb56e]/15 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#8bb56e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-3">Order Confirmed</span>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">Thank you!</h1>
        <p className="text-sm text-[#4a584a] leading-relaxed mb-6">
          Your order <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span> has been placed
          and saved to this device — you can review it anytime from your account.
        </p>
        <p className="text-xs text-[#4a584a]/70 italic mb-8">"Every cup is a snapshot of a place and a moment."</p>
        <div className="flex flex-col gap-3">
          <Link to={`/order/${orderNumber}`} className="w-full bg-[#8bb56e] hover:bg-[#9cc580] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors text-center">
            View Order Details
          </Link>
          <Link to="/shop" className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors text-center">
            Continue Shopping
          </Link>
          <Link to="/" className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all text-center">
            Back to Experience
          </Link>
        </div>
      </div>
    </div>
  )
}

export function EmptyCartScreen() {
  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
      <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
      <p className="text-sm text-[#4a584a] mb-8">Add a few teas before heading to checkout.</p>
      <Link to="/shop" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
        Browse the Collection
      </Link>
    </div>
  )
}
