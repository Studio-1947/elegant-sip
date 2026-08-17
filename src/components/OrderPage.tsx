import { getOrder } from '../lib/orders'
import { SHIPPING_METHODS } from '../lib/pricing'
import { Link, useDocumentMeta } from '../lib/router'

export default function OrderPage({ id }: { id?: string }) {
  const order = getOrder(id)
  useDocumentMeta(order ? `Order ${order.number} — Elegant Sip` : 'Order not found — Elegant Sip')

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Order not found</h1>
        <p className="text-sm text-[#4a584a] mb-8 max-w-md mx-auto">
          We couldn't find that order on this device. Orders are stored in the browser they were
          placed in — if you placed it here, it may have been cleared with your browsing data.
        </p>
        <Link to="/account" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
          Go to My Account
        </Link>
      </div>
    )
  }

  const method = SHIPPING_METHODS.find((m) => m.id === order.shippingMethod)
  const placedOn = new Date(order.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <Link to="/account" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors mb-6 inline-block">
          ← My Account
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Order</span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">{order.number}</h1>
          </div>
          <p className="text-xs font-mono text-[#4a584a]">Placed {placedOn}</p>
        </div>

        {/* Items */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Items</h2>
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={`${item.id}__${item.size}`} className="flex items-center gap-4">
                <Link to={`/product/${item.id}`} className="flex-shrink-0">
                  <img src={item.imageSrc} alt={item.name} className="w-14 h-16 object-cover rounded-lg border border-[#1b261b]/5" />
                </Link>
                <div className="flex-grow">
                  <Link to={`/product/${item.id}`} className="text-sm font-bold hover:text-[#8bb56e] transition-colors">{item.name}</Link>
                  <p className="text-[11px] text-[#4a584a]">{item.size} · Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-bold font-mono">${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Summary</h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-[#4a584a]"><span>Subtotal</span><span className="font-mono">${order.subtotal.toFixed(2)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[#8bb56e]"><span>Discount{order.coupon ? ` (${order.coupon})` : ''}</span><span className="font-mono">−${order.discount.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between text-[#4a584a]">
              <span>Shipping{method ? ` — ${method.label}` : ''}</span>
              <span className="font-mono">{order.shippingFee === 0 ? 'Free' : `$${order.shippingFee.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between text-[#4a584a]"><span>Estimated Tax</span><span className="font-mono">${order.tax.toFixed(2)}</span></div>
            <div className="border-t border-[#1b261b]/10 pt-3 mt-3 flex justify-between text-base font-bold">
              <span>Total</span><span className="font-mono">${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping details */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Delivery</h2>
          <div className="text-xs text-[#4a584a] space-y-1.5">
            <p><span className="font-bold text-[#1b261b]">Ship to:</span> {order.name}, {order.address}, {order.city} {order.zip}, {order.country}</p>
            <p><span className="font-bold text-[#1b261b]">Contact:</span> {order.email}</p>
            {method && <p><span className="font-bold text-[#1b261b]">Method:</span> {method.label} ({method.detail})</p>}
            {order.notes && <p><span className="font-bold text-[#1b261b]">Notes:</span> {order.notes}</p>}
          </div>
          <p className="text-[10px] font-mono text-[#8bb56e] italic mt-5">
            Demo store — this order is a record on this device only; nothing was charged or shipped.
          </p>
        </div>
      </div>
    </div>
  )
}
