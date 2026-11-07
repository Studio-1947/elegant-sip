import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiClientError, type InvoiceView, type OrderView } from '../lib/api'
import { SHIPPING_METHODS } from '../lib/pricing'
import { formatINR } from '../lib/currency'
import { Link, useDocumentMeta } from '../lib/router'
import { useAuth } from './AuthContext'
import { loadRazorpay } from '../lib/razorpay'

export default function OrderPage({ id }: { id?: string }) {
  const [order, setOrder] = useState<OrderView | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  const [requestType, setRequestType] = useState<'cancellation' | 'return'>('return')
  const [requestReason, setRequestReason] = useState('')
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [submittingRequest, setSubmittingRequest] = useState(false)
  const [loadingInvoice, setLoadingInvoice] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    const guestAccessToken = sessionStorage.getItem(`elegant_sip_order_access_${id}`)
    const load = () =>
      api.orders
        .get(id, guestAccessToken)
        .then((o) => {
          if (cancelled) return
          setOrder(o)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          setError(err instanceof ApiClientError ? err.message : 'We could not load that order.')
        })
        .finally(() => !cancelled && setLoading(false))

    void load()
    // A payment gateway webhook may arrive after the customer returns from its
    // hosted checkout. Poll only while payment is pending, then stop forever.
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && order?.status === 'pending_payment') void load()
    }, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(poll)
    }
  }, [id, order?.status])

  useDocumentMeta(
    order ? `Order ${order.number} | Elegant Sip` : 'Order not found | Elegant Sip',
    'Your Elegant Sip order details.',
    { noindex: true },
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
        <p className="text-sm text-[#4a584a]" aria-busy="true">Loading your order…</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Order not found</h1>
        <p className="text-sm text-[#4a584a] mb-8 max-w-md mx-auto">
          {error ?? 'Sign in with the account that placed this order to see it.'}
        </p>
        <Link to="/account" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
          Go to My Account
        </Link>
      </div>
    )
  }

  const method = SHIPPING_METHODS.find((m) => m.id === order.shippingMethod)
  const placedOn = new Date(order.placedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const canRequestService = Boolean(user && ['paid', 'packed', 'shipped', 'delivered'].includes(order.status))

  const submitServiceRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmittingRequest(true)
    setRequestMessage(null)
    try {
      await api.orders.requestReturn(order.number, { type: requestType, reason: requestReason })
      setRequestMessage('Your request has been sent to the Elegant Sip team. We will contact you after review.')
      setRequestReason('')
    } catch (cause) {
      setRequestMessage(cause instanceof ApiClientError ? cause.message : 'We could not submit your request.')
    } finally {
      setSubmittingRequest(false)
    }
  }

  /* Reopens Razorpay for an order still awaiting payment — for a customer who
     closed the payment window or came back from the account page. */
  const payNow = async () => {
    setPaying(true)
    setPaymentNotice(null)
    const guestAccessToken = sessionStorage.getItem(`elegant_sip_order_access_${order.number}`)
    let succeeded = false
    try {
      const [payment, Razorpay] = await Promise.all([api.orders.payment(order.number, guestAccessToken), loadRazorpay()])
      if (payment.provider !== 'razorpay') {
        setPaymentNotice('Online payment is not available for this order.')
        setPaying(false)
        return
      }
      const checkout = new Razorpay({
        key: payment.publicKey,
        amount: payment.amount,
        currency: payment.currency,
        name: 'Elegant Sip',
        description: `Order ${order.number}`,
        order_id: payment.gatewayOrderId,
        prefill: { name: order.shipping.name, email: order.email.endsWith('.invalid') ? undefined : order.email },
        theme: { color: '#4a7333' },
        handler: (response) => {
          succeeded = true
          void api.orders
            .verifyPayment(order.number, response, guestAccessToken)
            .then(({ status }) => {
              if (status === 'paid') setOrder({ ...order, status: 'paid', paidAt: new Date().toISOString() })
              else setPaymentNotice('Payment received and waiting for your bank to confirm. This page will update shortly.')
            })
            .catch((cause) => setPaymentNotice(cause instanceof ApiClientError ? cause.message : 'We could not confirm the payment yet. If you were charged, this page will update shortly.'))
            .finally(() => setPaying(false))
        },
        modal: { ondismiss: () => { if (!succeeded) setPaying(false) } },
      })
      checkout.on('payment.failed', (response) => {
        setPaymentNotice(`Payment failed: ${response.error?.description ?? 'the payment was declined'}. You can try again.`)
      })
      checkout.open()
    } catch (cause) {
      setPaying(false)
      setPaymentNotice(cause instanceof ApiClientError ? cause.message : cause instanceof Error ? cause.message : 'Payment could not open.')
    }
  }

  const printInvoice = async () => {
    setLoadingInvoice(true)
    try {
      const guestAccessToken = sessionStorage.getItem(`elegant_sip_order_access_${order.number}`)
      const { invoice } = await api.orders.invoice(order.number, guestAccessToken)
      openInvoicePrint(invoice)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Your invoice is not available yet.')
    } finally {
      setLoadingInvoice(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-3xl mx-auto">
        <Link to="/account" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#4a7333] transition-colors mb-6 inline-block">
          ← My Account
        </Link>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">Order</span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">{order.number}</h1>
          </div>
          <p className="text-xs font-mono text-[#4a584a]">Placed {placedOn}</p>
        </div>

        {order.status === 'pending_payment' && (
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-[#b0782e]/30 bg-[#b0782e]/8 px-4 py-3 text-xs text-[#4a584a] sm:flex-row sm:items-center sm:justify-between">
            <p>
              This order is awaiting payment. If you have already paid, it will update here shortly; otherwise pay now
              to keep your teas — unpaid orders are released after a short while.
            </p>
            <button
              type="button"
              onClick={() => void payNow()}
              disabled={paying}
              className="shrink-0 rounded-lg bg-[#1b261b] px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4a7333] disabled:opacity-60"
            >
              {paying ? 'Opening…' : `Pay now · ${formatINR(order.total)}`}
            </button>
          </div>
        )}
        {paymentNotice && (
          <p role="status" className="mb-6 rounded-lg border border-[#1b261b]/10 bg-white px-4 py-3 text-xs text-[#4a584a]">
            {paymentNotice}
          </p>
        )}

        <div className="mb-6 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b261b]/10 pb-4">
            <h2 className="text-sm font-bold uppercase tracking-wide">Order timeline</h2>
            {['paid', 'packed', 'shipped', 'delivered'].includes(order.status) && <button onClick={() => void printInvoice()} disabled={loadingInvoice} className="rounded-full border border-[#1b261b]/20 px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">{loadingInvoice ? 'Loading…' : 'Invoice / Print PDF'}</button>}
          </div>
          <ol className="mt-5 space-y-4">{timelineFor(order).map((event) => <li key={event.label} className="flex gap-3 text-xs"><span className={`mt-0.5 h-3 w-3 rounded-full border-2 ${event.complete ? 'border-[#4a7333] bg-[#8bb56e]' : 'border-[#1b261b]/20 bg-white'}`} /><div><p className={event.complete ? 'font-bold text-[#1b261b]' : 'text-[#4a584a]'}>{event.label}</p><p className="mt-0.5 text-[#4a584a]">{event.date ? new Date(event.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : event.detail}</p></div></li>)}</ol>
        </div>

        {order.shipment && (
          <div className="mb-6 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1b261b]/10 pb-4">
              <h2 className="text-sm font-bold uppercase tracking-wide">Tracking</h2>
              <span className="rounded-full bg-[#8bb56e]/15 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#315b26]">
                {SHIPMENT_LABELS[order.shipment.status] ?? order.shipment.status.replaceAll('_', ' ')}
              </span>
            </div>
            <div className="mt-4 grid gap-2 text-xs text-[#4a584a] sm:grid-cols-2">
              <p><span className="font-bold text-[#1b261b]">Courier:</span> {order.shipment.courierName ?? 'Assigned shortly'}</p>
              <p><span className="font-bold text-[#1b261b]">AWB:</span> <span className="font-mono">{order.shipment.awb}</span></p>
              {order.shipment.deliveredAt ? (
                <p><span className="font-bold text-[#1b261b]">Delivered:</span> {new Date(order.shipment.deliveredAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
              ) : order.shipment.expectedDeliveryAt && (
                <p><span className="font-bold text-[#1b261b]">Expected by:</span> {new Date(order.shipment.expectedDeliveryAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
              )}
            </div>
            {order.shipment.events.length > 0 && (
              <ol className="mt-5 space-y-3 border-l border-[#1b261b]/10 pl-4">
                {[...order.shipment.events].reverse().map((event) => (
                  <li key={`${event.at}-${event.status}`} className="text-xs">
                    <p className="font-bold text-[#1b261b]">{event.status}{event.location ? ` · ${event.location}` : ''}</p>
                    <p className="mt-0.5 text-[#4a584a]">{new Date(event.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                  </li>
                ))}
              </ol>
            )}
            {order.shipment.trackingUrl && (
              <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="mt-5 inline-block rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333]">
                Track on courier site
              </a>
            )}
          </div>
        )}

        {/* Items */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Items</h2>
          <div className="space-y-4">
            {order.items.map((item: OrderView["items"][number]) => (
              <div key={`${item.productSlug}__${item.variantSize}`} className="flex items-center gap-4">
                <Link to={`/product/${item.productSlug}`} className="flex-shrink-0">
                  <img src={item.imageSrc} alt={item.productName} loading="lazy" width={56} height={64} className="w-14 h-16 object-cover rounded-lg border border-[#1b261b]/5" />
                </Link>
                <div className="flex-grow">
                  <Link to={`/product/${item.productSlug}`} className="text-sm font-bold hover:text-[#4a7333] transition-colors">{item.productName}</Link>
                  <p className="text-[11px] text-[#4a584a]">{item.variantSize} · Qty {item.quantity}</p>
                </div>
                <span className="text-sm font-bold font-mono">{formatINR(item.lineTotal)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Summary</h2>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between text-[#4a584a]"><span>Subtotal</span><span className="font-mono">{formatINR(order.subtotal)}</span></div>
            {order.discount > 0 && (
              <div className="flex justify-between text-[#4a7333]"><span>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</span><span className="font-mono">−{formatINR(order.discount)}</span></div>
            )}
            <div className="flex justify-between text-[#4a584a]">
              <span>Shipping{method ? `  ${method.label}` : ''}</span>
              <span className="font-mono">{order.shippingFee === 0 ? 'Free' : formatINR(order.shippingFee)}</span>
            </div>
            <div className="flex justify-between text-[#4a584a]"><span>GST</span><span className="font-mono">{formatINR(order.tax)}</span></div>
            <div className="border-t border-[#1b261b]/10 pt-3 mt-3 flex justify-between text-base font-bold">
              <span>Total</span><span className="font-mono">{formatINR(order.total)}</span>
            </div>
          </div>
        </div>

        {/* Shipping details */}
        <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
          <h2 className="text-sm font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-5">Delivery</h2>
          <div className="text-xs text-[#4a584a] space-y-1.5">
            <p><span className="font-bold text-[#1b261b]">Ship to:</span> {order.shipping.name}, {order.shipping.line1}, {order.shipping.city} {order.shipping.postalCode}, {order.shipping.country}</p>
            <p><span className="font-bold text-[#1b261b]">Contact:</span> {order.email}</p>
            {method && <p><span className="font-bold text-[#1b261b]">Method:</span> {method.label} ({method.detail})</p>}
            {order.tracking?.number && (
              <p>
                <span className="font-bold text-[#1b261b]">Tracking:</span>{" "}
                {order.tracking.carrier ? `${order.tracking.carrier} · ` : ""}
                <span className="font-mono">{order.tracking.number}</span>
              </p>
            )}
          </div>
        </div>
        {canRequestService && (
          <form onSubmit={submitServiceRequest} className="mt-6 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8">
            <h2 className="text-sm font-bold uppercase tracking-wide">Need help with this order?</h2>
            <p className="mt-2 text-xs leading-relaxed text-[#4a584a]">Request a cancellation or return. A staff member reviews every request; accepted physical returns are inspected before any stock is restored.</p>
            <div className="mt-5 flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-2"><input type="radio" checked={requestType === 'return'} onChange={() => setRequestType('return')} /> Return</label>
              <label className="flex items-center gap-2"><input type="radio" checked={requestType === 'cancellation'} onChange={() => setRequestType('cancellation')} /> Cancellation</label>
            </div>
            <label className="mt-4 block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Reason<textarea required minLength={10} maxLength={500} value={requestReason} onChange={(event) => setRequestReason(event.target.value)} className="mt-2 block min-h-24 w-full rounded-lg border border-[#1b261b]/15 p-3 text-sm normal-case tracking-normal" placeholder="Tell us what happened so the team can help." /></label>
            {requestMessage && <p role="status" className="mt-3 text-xs text-[#4a7333]">{requestMessage}</p>}
            <button disabled={submittingRequest || requestReason.trim().length < 10} className="mt-4 rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333] disabled:opacity-50">{submittingRequest ? 'Sending…' : 'Send request'}</button>
          </form>
        )}
      </div>
    </div>
  )
}

const SHIPMENT_LABELS: Record<string, string> = {
  awb_assigned: 'Preparing to ship',
  pickup_scheduled: 'Awaiting courier pickup',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  exception: 'Delivery delayed',
  rto: 'Returning to us',
}

function timelineFor(order: OrderView) {
  const paid = ['paid', 'packed', 'shipped', 'delivered'].includes(order.status)
  const packed = ['packed', 'shipped', 'delivered'].includes(order.status)
  const shipped = ['shipped', 'delivered'].includes(order.status)
  const delivered = order.status === 'delivered'
  if (order.status === 'cancelled') return [{ label: 'Order placed', complete: true, date: order.placedAt }, { label: 'Cancelled', complete: true, date: order.cancelledAt, detail: 'This order was cancelled.' }]
  if (order.status === 'refunded') return [{ label: 'Order placed', complete: true, date: order.placedAt }, { label: 'Refunded', complete: true, date: null, detail: 'Your refund has been processed.' }]
  return [
    { label: 'Order placed', complete: true, date: order.placedAt, detail: '' },
    { label: 'Payment confirmed', complete: paid, date: order.paidAt, detail: paid ? 'Payment confirmed.' : 'Awaiting secure payment confirmation.' },
    { label: 'Packed', complete: packed, date: null, detail: packed ? 'Your teas have been packed.' : 'We will pack your order next.' },
    { label: 'Shipped', complete: shipped, date: order.shippedAt, detail: shipped ? (order.tracking?.number ? `Tracking: ${order.tracking.number}` : 'With the courier.') : 'Tracking will appear here when dispatched.' },
    { label: 'Delivered', complete: delivered, date: null, detail: delivered ? 'Marked delivered.' : 'Awaiting delivery confirmation.' },
  ]
}

function openInvoicePrint(invoice: InvoiceView) {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=820')
  if (!popup) return
  const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)
  const taxLines = [["CGST", invoice.totals.cgst], ["SGST", invoice.totals.sgst], ["IGST", invoice.totals.igst]].filter(([, value]) => value).map(([label, value]) => `<tr><td>${label}</td><td>${safe(value!)}</td></tr>`).join('')
  // eslint-disable-next-line no-useless-escape -- preserves a literal closing script tag in generated print HTML.
  popup.document.write(`<!doctype html><title>Invoice ${safe(invoice.number)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#182518}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}.right{text-align:right}.muted{color:#526052;font-size:12px}</style><h1>Elegant Sip — ${invoice.isTaxInvoice ? 'Tax Invoice' : 'Provisional Invoice'}</h1><p><b>${safe(invoice.number)}</b><br><span class="muted">Issued ${safe(new Date(invoice.issuedAt).toLocaleDateString('en-IN'))} · HSN ${safe(invoice.hsn)}</span></p><p><b>Bill to</b><br>${safe(invoice.buyer.name)}<br>${safe(invoice.buyer.line1)}<br>${safe(invoice.buyer.city)}, ${safe(invoice.buyer.state ?? '')} ${safe(invoice.buyer.postalCode)}</p><table><thead><tr><th>Description</th><th>Qty</th><th class="right">Amount</th></tr></thead><tbody>${invoice.lines.map((line) => `<tr><td>${safe(line.description)}</td><td>${line.quantity}</td><td class="right">${safe(line.lineTotal)}</td></tr>`).join('')}</tbody></table><table><tbody><tr><td>Subtotal</td><td class="right">${safe(invoice.totals.subtotal)}</td></tr><tr><td>Shipping</td><td class="right">${safe(invoice.totals.shipping)}</td></tr>${taxLines}<tr><td><b>Total</b></td><td class="right"><b>${safe(invoice.totals.total)}</b></td></tr></tbody></table><script>window.onload=()=>window.print()<\/script>`)
  popup.document.close()
}
