import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { ApiClientError, api, type AdminConfig, type AdminOrder, type AdminOrderDetail, type AdminOrderStatus, type AdminReturnRequest, type LowStockVariant } from '../lib/api'
import { formatINR } from '../lib/currency'
import { Link, useDocumentMeta } from '../lib/router'

const filters: Array<{ value: '' | AdminOrderStatus; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
]

const nextActions: Record<AdminOrderStatus, Array<{ status: 'packed' | 'shipped' | 'delivered' | 'cancelled'; label: string }>> = {
  pending_payment: [{ status: 'cancelled', label: 'Cancel' }],
  paid: [{ status: 'packed', label: 'Mark packed' }, { status: 'cancelled', label: 'Cancel' }],
  packed: [{ status: 'shipped', label: 'Add tracking & ship' }, { status: 'cancelled', label: 'Cancel' }],
  shipped: [{ status: 'delivered', label: 'Mark delivered' }],
  delivered: [],
  cancelled: [],
  refunded: [],
}

function StatusPill({ status }: { status: AdminOrderStatus }) {
  const colors: Record<AdminOrderStatus, string> = {
    pending_payment: 'bg-amber-50 text-amber-800 border-amber-200',
    paid: 'bg-sky-50 text-sky-800 border-sky-200',
    packed: 'bg-violet-50 text-violet-800 border-violet-200',
    shipped: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    delivered: 'bg-green-50 text-green-800 border-green-200',
    cancelled: 'bg-stone-100 text-stone-600 border-stone-200',
    refunded: 'bg-rose-50 text-rose-800 border-rose-200',
  }
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider ${colors[status]}`}>{status.replaceAll('_', ' ')}</span>
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [filter, setFilter] = useState<'' | AdminOrderStatus>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)
  const [shippingOrder, setShippingOrder] = useState<AdminOrder | null>(null)
  const [carrier, setCarrier] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)
  const [returnRequests, setReturnRequests] = useState<AdminReturnRequest[]>([])
  const [lowStock, setLowStock] = useState<LowStockVariant[]>([])

  useDocumentMeta('Staff Operations | Elegant Sip', 'Restricted staff order operations.', { noindex: true })

  const load = useCallback(async (currentFilter: '' | AdminOrderStatus) => {
    setLoading(true)
    setError('')
    try {
      const [orderResponse, configResponse, returnResponse, lowStockResponse] = await Promise.all([
        api.admin.listOrders(currentFilter || undefined),
        api.admin.config(),
        api.admin.listReturnRequests(),
        api.admin.lowStock(),
      ])
      setOrders(orderResponse.orders)
      setConfig(configResponse)
      setReturnRequests(returnResponse.requests)
      setLowStock(lowStockResponse.variants)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Could not load the staff dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'admin') void load(filter)
  }, [filter, load, user?.role])

  const update = async (order: AdminOrder, status: 'packed' | 'shipped' | 'delivered' | 'cancelled', details?: { carrier?: string; trackingNumber?: string }) => {
    setUpdating(order.number)
    setError('')
    try {
      const result = await api.admin.updateOrder(order.number, {
        status,
        ...(details?.carrier ? { trackingCarrier: details.carrier } : {}),
        ...(details?.trackingNumber ? { trackingNumber: details.trackingNumber } : {}),
      })
      setOrders((current) => current.map((item) => item.number === order.number ? {
        ...item,
        status,
        trackingNumber: details?.trackingNumber ?? item.trackingNumber,
      } : item))
      setShippingOrder(null)
      if (result.notified) setError(`Shipment email sent to ${order.email}.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The order could not be updated.')
    } finally {
      setUpdating(null)
    }
  }

  const openDetail = async (order: AdminOrder) => {
    setLoadingDetail(order.number)
    setError('')
    try {
      setDetail(await api.admin.getOrder(order.number))
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Order detail could not be loaded.')
    } finally {
      setLoadingDetail(null)
    }
  }

  const updateReturnRequest = async (item: AdminReturnRequest, status: 'approved' | 'rejected' | 'received') => {
    setUpdating(item.id)
    setError('')
    try {
      const result = await api.admin.updateReturnRequest(item.id, { status })
      setReturnRequests((current) => current.map((request) => request.id === item.id ? { ...request, status } : request))
      if (result.restocked) setError(`Return ${item.number} received and stock restored to the ledger.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The return request could not be updated.')
    } finally {
      setUpdating(null)
    }
  }

  if (authLoading) return <div className="min-h-screen bg-[#f9faf7] pt-40 text-center text-sm text-[#4a584a]">Checking staff access…</div>

  if (!user) return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] pt-40 px-6 text-center">
      <h1 className="text-3xl font-bold uppercase">Staff access</h1>
      <p className="mt-4 text-sm text-[#4a584a]">Sign in with a staff account to access order operations.</p>
      <Link to="/account" className="inline-block mt-7 rounded-lg bg-[#1b261b] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white">Sign in</Link>
    </div>
  )

  if (user.role !== 'admin') return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] pt-40 px-6 text-center">
      <h1 className="text-3xl font-bold uppercase">Restricted area</h1>
      <p className="mt-4 text-sm text-[#4a584a]">This area is available only to authorised Elegant Sip staff.</p>
      <Link to="/account" className="inline-block mt-7 rounded-lg border border-[#1b261b]/20 px-6 py-3 text-xs font-bold uppercase tracking-widest">Back to account</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] pt-32 pb-24 px-5 md:px-12 lg:px-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="block text-xs font-mono uppercase tracking-[0.3em] text-[#4a7333]">Staff only</span>
            <h1 className="mt-2 text-4xl font-bold uppercase tracking-tight md:text-5xl">Order operations</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#4a584a]">Work paid orders through packing, shipment, and delivery. The API verifies your staff role on every action.</p>
          </div>
          <button onClick={() => void load(filter)} disabled={loading} className="rounded-full border border-[#1b261b]/20 px-5 py-2.5 text-xs font-mono uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh queue'}</button>
        </div>

        {config && <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ConfigCard label="Payments" value={config.paymentsLive ? 'Razorpay live' : `${config.paymentProvider} not live`} ready={config.paymentsLive} />
          <ConfigCard label="Customer email" value={config.emailConfigured ? 'Configured' : 'Not configured'} ready={config.emailConfigured} />
          <ConfigCard label="GST invoice" value={config.gstinConfigured ? 'GSTIN configured' : 'GSTIN needed'} ready={config.gstinConfigured} />
          <ConfigCard label="Seller location" value={config.sellerState} ready />
        </div>}

        {lowStock.length > 0 && <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex flex-wrap items-baseline justify-between gap-2"><div><span className="text-[10px] font-mono uppercase tracking-[0.25em] text-amber-800">Inventory attention</span><h2 className="mt-1 text-lg font-bold uppercase tracking-tight">{lowStock.length} low-stock variant{lowStock.length === 1 ? '' : 's'}</h2></div><span className="text-xs text-amber-800">5 packs or fewer</span></div><ul className="mt-4 divide-y divide-amber-200/70">{lowStock.map((variant) => <li key={`${variant.productSlug}-${variant.size}`} className="flex items-center justify-between gap-4 py-2 text-sm"><span>{variant.productName} <span className="text-[#4a584a]">({variant.size})</span></span><b className="font-mono text-amber-800">{variant.stock} left</b></li>)}</ul></section>}

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-mono uppercase tracking-wider text-[#4a584a]">Queue filter
            <select value={filter} onChange={(event) => setFilter(event.target.value as '' | AdminOrderStatus)} className="ml-3 rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-xs text-[#1b261b]">
              {filters.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <span className="text-xs font-mono text-[#4a584a]">{orders.length} shown</span>
        </div>

        {error && <div role="status" className="mb-5 rounded-xl border border-[#8bb56e]/50 bg-[#f0f7ea] px-4 py-3 text-sm text-[#315b26]">{error}</div>}

        <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          {loading ? <div className="p-10 text-center text-sm text-[#4a584a]">Loading the order queue…</div> : orders.length === 0 ? <div className="p-10 text-center text-sm text-[#4a584a]">No orders match this filter.</div> : (
            <div className="divide-y divide-[#1b261b]/10">
              {orders.map((order) => <article key={order.number} className="p-5 md:p-6">
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5"><Link to={`/order/${order.number}`} className="font-mono text-sm font-bold hover:text-[#4a7333]">{order.number}</Link><StatusPill status={order.status} /></div>
                    <p className="mt-2 text-xs text-[#4a584a]">{order.email} · {order.itemCount} items · {order.shippingCity} · {new Date(order.placedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    {order.trackingNumber && <p className="mt-1 text-xs font-mono text-[#4a7333]">Tracking: {order.trackingNumber}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end"><span className="mr-2 text-sm font-bold">{formatINR(order.total)}</span><button onClick={() => void openDetail(order)} disabled={loadingDetail === order.number} className="rounded-full border border-[#1b261b]/20 px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider hover:border-[#8bb56e] disabled:opacity-50">{loadingDetail === order.number ? 'Loading…' : 'Details'}</button>{nextActions[order.status].map((action) => <button key={action.status} disabled={updating === order.number} onClick={() => action.status === 'shipped' ? (setShippingOrder(order), setCarrier(''), setTrackingNumber('')) : void update(order, action.status)} className={`rounded-full px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-50 ${action.status === 'cancelled' ? 'border border-rose-200 text-rose-700 hover:bg-rose-50' : 'bg-[#1b261b] text-white hover:bg-[#4a7333]'}`}>{updating === order.number ? 'Saving…' : action.label}</button>)}</div>
                </div>
                {shippingOrder?.number === order.number && <form onSubmit={(event) => { event.preventDefault(); if (!trackingNumber.trim()) { setError('A tracking number is required before marking an order shipped.'); return }; void update(order, 'shipped', { carrier: carrier.trim(), trackingNumber: trackingNumber.trim() }) }} className="mt-5 grid gap-3 rounded-xl bg-[#f9faf7] p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Courier<input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={60} className="mt-1.5 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm" placeholder="e.g. Delhivery" /></label>
                  <label className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Tracking number<input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={60} required className="mt-1.5 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm" /></label>
                  <button disabled={updating === order.number} className="rounded-lg bg-[#4a7333] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">Confirm shipment</button>
                  <button type="button" onClick={() => setShippingOrder(null)} className="px-3 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Cancel</button>
                </form>}
              </article>)}
            </div>
          )}
        </div>
        <section className="mt-10">
          <div className="mb-4 flex items-baseline justify-between gap-4"><div><span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Customer care</span><h2 className="mt-1 text-xl font-bold uppercase tracking-tight">Returns & cancellations</h2></div><span className="text-xs font-mono text-[#4a584a]">{returnRequests.filter((item) => item.status === 'requested').length} awaiting review</span></div>
          <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white">
            {returnRequests.length === 0 ? <p className="p-6 text-sm text-[#4a584a]">No customer requests yet.</p> : <div className="divide-y divide-[#1b261b]/10">{returnRequests.map((item) => <article key={item.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-bold">{item.number}</span><span className="rounded-full border border-[#1b261b]/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wider">{item.type}</span><span className="text-[10px] font-mono uppercase tracking-wider text-[#4a7333]">{item.status}</span></div><p className="mt-2 max-w-2xl text-sm text-[#4a584a]">{item.reason}</p><p className="mt-1 text-[10px] font-mono text-[#4a584a]">Requested {new Date(item.requestedAt).toLocaleDateString('en-IN')}</p></div><div className="flex flex-wrap gap-2">{item.status === 'requested' && <><button onClick={() => void updateReturnRequest(item, 'approved')} disabled={updating === item.id} className="rounded-full bg-[#1b261b] px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-white disabled:opacity-50">Approve</button><button onClick={() => void updateReturnRequest(item, 'rejected')} disabled={updating === item.id} className="rounded-full border border-rose-200 px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 disabled:opacity-50">Reject</button></>}{item.status === 'approved' && item.type === 'return' && <button onClick={() => void updateReturnRequest(item, 'received')} disabled={updating === item.id} className="rounded-full bg-[#4a7333] px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-white disabled:opacity-50">Mark received</button>}{item.status === 'approved' && item.type === 'cancellation' && <span className="max-w-[180px] text-[10px] text-[#4a584a]">Refund is pending gateway setup.</span>}</div></article>)}</div>}
          </div>
        </section>
      </div>
      {detail && <OrderDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  )
}

function ConfigCard({ label, value, ready }: { label: string; value: string; ready: boolean }) {
  return <div className="rounded-xl border border-[#1b261b]/10 bg-white p-4"><p className="text-[10px] font-mono uppercase tracking-widest text-[#4a584a]">{label}</p><p className={`mt-2 text-sm font-bold ${ready ? 'text-[#315b26]' : 'text-amber-700'}`}>{value}</p></div>
}

function OrderDetailModal({ detail, onClose }: { detail: AdminOrderDetail; onClose: () => void }) {
  const printSlip = () => {
    const popup = window.open('', '_blank', 'noopener,noreferrer,width=720,height=820')
    if (!popup) return
    const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)
    popup.document.write(`<!doctype html><title>Packing slip ${safe(detail.number)}</title><style>body{font-family:Arial,sans-serif;margin:32px;color:#182518}h1{font-size:24px}table{border-collapse:collapse;width:100%;margin-top:20px}th,td{padding:10px;border-bottom:1px solid #ddd;text-align:left}.muted{color:#526052;font-size:12px}</style><h1>Elegant Sip — Packing Slip</h1><p><b>${safe(detail.number)}</b><br><span class="muted">Placed ${safe(new Date(detail.placedAt).toLocaleString('en-IN'))}</span></p><h2>Deliver to</h2><p>${safe(detail.shipping.name)}<br>${safe(detail.shipping.line1)}<br>${safe(detail.shipping.city)}, ${safe(detail.shipping.state ?? '')} ${safe(detail.shipping.postalCode)}<br>${safe(detail.shipping.country)}${detail.phone ? `<br>${safe(detail.phone)}` : ''}</p><h2>Items</h2><table><thead><tr><th>Tea</th><th>Pack</th><th>Qty</th></tr></thead><tbody>${detail.items.map((item) => `<tr><td>${safe(item.productName)}</td><td>${safe(item.variantSize)}</td><td>${item.quantity}</td></tr>`).join('')}</tbody></table>${detail.notes ? `<p><b>Customer note:</b> ${safe(detail.notes)}</p>` : ''}<script>window.onload=()=>window.print()<\/script>`)
    popup.document.close()
  }
  return <div role="dialog" aria-modal="true" aria-label={`Order ${detail.number} details`} className="fixed inset-0 z-[70] flex items-end bg-black/45 p-0 sm:items-center sm:justify-center sm:p-6">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl md:p-8">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-mono uppercase tracking-widest text-[#4a7333]">Fulfilment detail</p><h2 className="mt-1 font-mono text-xl font-bold">{detail.number}</h2></div><button onClick={onClose} className="text-xs font-mono uppercase tracking-wider text-[#4a584a]">Close</button></div>
      <div className="mt-6 grid gap-6 sm:grid-cols-2"><section><h3 className="text-xs font-bold uppercase tracking-wider">Delivery</h3><p className="mt-2 text-sm leading-relaxed text-[#4a584a]">{detail.shipping.name}<br />{detail.shipping.line1}<br />{detail.shipping.city}{detail.shipping.state ? `, ${detail.shipping.state}` : ''} {detail.shipping.postalCode}<br />{detail.shipping.country}</p></section><section><h3 className="text-xs font-bold uppercase tracking-wider">Customer</h3><p className="mt-2 text-sm leading-relaxed text-[#4a584a]">{detail.email}<br />{detail.phone ?? 'No phone supplied'}<br />Placed {new Date(detail.placedAt).toLocaleString('en-IN')}</p></section></div>
      <section className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wider">Pack list</h3><ul className="mt-2 divide-y divide-[#1b261b]/10 border-y border-[#1b261b]/10">{detail.items.map((item, index) => <li key={`${item.productName}-${index}`} className="flex justify-between gap-4 py-3 text-sm"><span>{item.productName} <span className="text-[#4a584a]">({item.variantSize})</span></span><b>×{item.quantity}</b></li>)}</ul></section>
      {detail.notes && <p className="mt-5 rounded-lg bg-[#f9faf7] p-3 text-sm text-[#4a584a]"><b>Customer note:</b> {detail.notes}</p>}
      <button onClick={printSlip} className="mt-6 rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333]">Print packing slip</button>
    </div>
  </div>
}
