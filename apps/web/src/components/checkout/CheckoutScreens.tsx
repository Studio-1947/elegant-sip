import { Link } from '../../lib/router'
import { formatINR } from '../../lib/currency'
import type { OrderView } from '../../lib/api'

/**
 * Shown once an order is created, while it is paid for, and after.
 *
 * Until the gateway confirms payment the order is `pending_payment`: the teas
 * are held, nothing is confirmed. The screen leads with what the customer
 * still has to do (pay) rather than a success tick, so a cancelled or failed
 * payment can never read as a finished purchase. The tick and "Payment
 * received" appear only once the order is actually paid.
 */
export function OrderConfirmedScreen({
  orderNumber,
  order,
  paymentProvider,
  paymentNotice,
  paying = false,
  paymentSubmitted = false,
  onPay,
  guestEmail,
}: {
  orderNumber: string
  order: OrderView | null
  paymentProvider?: string
  paymentNotice?: string | null
  paying?: boolean
  /** The gateway took the payment but the server hasn't confirmed it: don't invite a second payment. */
  paymentSubmitted?: boolean
  onPay?: () => void
  /** Set for a guest order, whose page opens only in this browser tab. */
  guestEmail?: string
}) {
  const awaitingPayment = order?.status === 'pending_payment' || order === null
  // Paid at the gateway, waiting for the server's confirmation.
  const confirming = awaitingPayment && paymentSubmitted
  // A payment attempt was cancelled or failed (the checkout sets a notice).
  const paymentStalled = awaitingPayment && !confirming && Boolean(paymentNotice)

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
      <div className="max-w-lg mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
        {awaitingPayment ? (
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 flex items-center justify-center">
            {/* A clock: waiting on payment, not done. */}
            <svg className="w-8 h-8 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        ) : (
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#8bb56e]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#4a7333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )}

        <span className={`${awaitingPayment ? 'text-amber-800' : 'text-[#4a7333]'} text-xs font-mono tracking-[0.3em] uppercase block mb-3`}>
          {!awaitingPayment ? 'Order Confirmed' : confirming ? 'Confirming payment' : 'Not paid yet'}
        </span>
        <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">
          {!awaitingPayment
            ? 'Payment received'
            : confirming
              ? 'Confirming your payment'
              : paymentStalled
                ? 'Payment not completed'
                : 'Complete your payment'}
        </h1>

        <p className="text-sm text-[#4a584a] leading-relaxed mb-4">
          {confirming ? (
            <>
              Razorpay has passed on your payment for order{' '}
              <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span> and we are waiting for the bank to
              confirm it. This usually takes a minute. Please don't pay again — your order page updates by itself.
            </>
          ) : awaitingPayment ? (
            <>
              Order <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span> is not paid yet. Your teas
              are held for a short while — pay now to confirm the order. If it isn't paid, it is cancelled automatically.
            </>
          ) : (
            <>
              Your order <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span> is paid and being packed.
            </>
          )}
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

        {awaitingPayment && !confirming && paymentProvider === 'razorpay' && !paymentNotice && (
          <p className="text-[11px] text-[#4a584a] leading-relaxed mb-8 border border-[#4a7333]/30 bg-[#4a7333]/8 rounded-lg px-4 py-3">
            {paying ? 'Complete payment in the Razorpay window.' : 'Pay now to confirm your order.'}
          </p>
        )}

        {confirming && paymentNotice && (
          <p role="status" className="text-[11px] text-[#4a584a] leading-relaxed mb-8 border border-[#1b261b]/10 bg-[#f9faf7] rounded-lg px-4 py-3">
            {paymentNotice}
          </p>
        )}

        {paymentStalled && (
          <p role="alert" className="text-[11px] text-red-800 leading-relaxed mb-8 border border-red-700/30 bg-red-50 rounded-lg px-4 py-3">
            {paymentNotice}
          </p>
        )}

        {guestEmail !== undefined && (
          <p className="text-[11px] text-[#4a584a] leading-relaxed mb-8 border border-[#1b261b]/10 bg-[#f9faf7] rounded-lg px-4 py-3">
            Your order page opens only in this browser tab, so note your order number. To see it later
            from anywhere, create an account{guestEmail ? <> with <span className="font-semibold text-[#1b261b]">{guestEmail}</span></> : ' with the same email'}.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {awaitingPayment && !confirming && paymentProvider === 'razorpay' && onPay && (
            <button
              type="button"
              onClick={onPay}
              disabled={paying}
              className="w-full bg-[#4a7333] hover:bg-[#3b5c29] disabled:opacity-60 text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors"
            >
              {paying ? 'Processing…' : 'Pay now'}
            </button>
          )}
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
