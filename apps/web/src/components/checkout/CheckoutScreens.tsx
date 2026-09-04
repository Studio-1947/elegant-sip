import { Link } from '../../lib/router'
import { formatINR } from '../../lib/currency'
import type { OrderView } from '../../lib/api'

/** Post-purchase confirmation screen — the order is saved to this device only. */
/**
 * Shown immediately after an order is created.
 *
 * The order is `pending_payment` at this point, not paid — payment is only
 * confirmed when the gateway's signed webhook arrives. So this screen says the
 * order was *placed*, never that it was confirmed or paid, and it does not
 * claim a receipt has been emailed. The order page reflects the real status as
 * soon as it changes.
 */
export function OrderConfirmedScreen({
  orderNumber,
  order,
  paymentProvider,
  paymentError,
}: {
  orderNumber: string
  order: OrderView | null
  paymentProvider?: string
  paymentError?: string | null
}) {
  const awaitingPayment = order?.status === 'pending_payment' || order === null

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
      <div className="max-w-lg mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#8bb56e]/15 flex items-center justify-center">
          <svg className="w-8 h-8 text-[#4a7333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
          {awaitingPayment ? 'Awaiting Payment' : 'Order Confirmed'}
        </span>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">
          {awaitingPayment ? 'Order placed' : 'Payment received'}
        </h1>

        <p className="text-sm text-[#4a584a] leading-relaxed mb-4">
          Your order <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span>{' '}
          {awaitingPayment
            ? 'has been placed and your teas are held for you. It is not paid yet — complete payment to confirm it.'
            : 'is paid and being packed.'}
        </p>

        {order && (
          <p className="text-sm text-[#4a584a] mb-6">
            Total <span className="font-bold text-[#1b261b]">{formatINR(order.total)}</span>
          </p>
        )}

        {awaitingPayment && paymentProvider !== 'razorpay' && (
          <p className="text-[11px] text-[#4a584a] leading-relaxed mb-8 border border-[#b0782e]/30 bg-[#b0782e]/8 rounded-lg px-4 py-3">
            This development order has not been charged. To complete it, message us on{' '}
            <a href="https://wa.me/917583995294" className="font-semibold text-[#4a7333] underline underline-offset-2">
              WhatsApp
            </a>{' '}
            quoting your order number.
          </p>
        )}

        {awaitingPayment && paymentProvider === 'razorpay' && (
          <p className="text-[11px] text-[#4a584a] leading-relaxed mb-8 border border-[#4a7333]/30 bg-[#4a7333]/8 rounded-lg px-4 py-3">
            Payment is being confirmed securely. Open your order again to see its latest status.
          </p>
        )}

        {paymentError && (
          <p role="alert" className="text-[11px] text-red-800 leading-relaxed mb-8 border border-red-700/30 bg-red-50 rounded-lg px-4 py-3">
            Your order was saved, but checkout could not open: {paymentError}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <Link to={`/order/${orderNumber}`} className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors text-center">
            View Order
          </Link>
          <Link to="/shop" className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all text-center">
            Continue Shopping
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
