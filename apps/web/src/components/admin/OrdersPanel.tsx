import { useState, type CSSProperties } from 'react'
import { api, type AdminOrder, type AdminOrderDetail, type AdminOrderStatus } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { Link } from '../../lib/router'
import { formatShortDate } from '../../lib/dates'
import OrderDetailModal from './OrderDetailModal'
import { cardClass, errorText, inputClass, labelClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner } from './ui/controls'

type Action = 'packed' | 'shipped' | 'delivered' | 'cancelled'

const FILTERS: Array<{ value: '' | AdminOrderStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'To pack' },
  { value: 'packed', label: 'To ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
]

const NEXT: Record<AdminOrderStatus, Array<{ status: Action; label: string }>> = {
  pending_payment: [{ status: 'cancelled', label: 'Cancel' }],
  paid: [{ status: 'packed', label: 'Mark packed' }, { status: 'cancelled', label: 'Cancel' }],
  packed: [{ status: 'shipped', label: 'Ship…' }, { status: 'cancelled', label: 'Cancel' }],
  shipped: [{ status: 'delivered', label: 'Mark delivered' }],
  delivered: [],
  cancelled: [],
  refunded: [],
}

const PILL: Record<AdminOrderStatus, string> = {
  pending_payment: 'bg-amber-100 text-amber-800',
  paid: 'bg-sky-100 text-sky-800',
  packed: 'bg-violet-100 text-violet-800',
  shipped: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-stone-200 text-stone-600',
  refunded: 'bg-rose-100 text-rose-800',
}

export function StatusPill({ status }: { status: AdminOrderStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${PILL[status]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {status.replaceAll('_', ' ')}
    </span>
  )
}

export default function OrdersPanel({
  orders,
  loading,
  reload,
  onUpdated,
  filter,
  onFilter,
}: {
  filter: '' | AdminOrderStatus
  onFilter: (f: '' | AdminOrderStatus) => void
  orders: AdminOrder[]
  loading: boolean
  reload: () => void
  onUpdated: (number: string, patch: Partial<AdminOrder>) => void
}) {
  const { toast, confirm } = useFeedback()
  const [updating, setUpdating] = useState<string | null>(null)
  const [shipping, setShipping] = useState<AdminOrder | null>(null)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [detail, setDetail] = useState<AdminOrderDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  const count = (status: '' | AdminOrderStatus) => (status ? orders.filter((o) => o.status === status).length : orders.length)
  const shown = filter ? orders.filter((o) => o.status === filter) : orders

  const update = async (order: AdminOrder, status: Action, details?: { carrier?: string; trackingNumber?: string }) => {
    if (status === 'cancelled') {
      const ok = await confirm({
        title: `Cancel order ${order.number}?`,
        body: `${order.email} · ${formatINR(order.total)}. The order stops here and can't be moved forward again.`,
        confirmLabel: 'Cancel order',
        danger: true,
      })
      if (!ok) return
    }
    setUpdating(order.number)
    try {
      const result = await api.admin.updateOrder(order.number, {
        status,
        ...(details?.carrier ? { trackingCarrier: details.carrier } : {}),
        ...(details?.trackingNumber ? { trackingNumber: details.trackingNumber } : {}),
      })
      onUpdated(order.number, { status, ...(details?.trackingNumber ? { trackingNumber: details.trackingNumber } : {}) })
      setShipping(null)
      toast({
        tone: 'ok',
        title: `${order.number} · ${status}`,
        text: result.notified ? `${status === 'delivered' ? 'Delivery' : 'Shipment'} email sent to ${order.email}.` : 'Order updated.',
      })
      // Cancelling a paid order does not refund it by itself.
      if (result.refundDue) {
        toast({ tone: 'info', title: 'Refund still due', text: `${order.number} is cancelled but its payment has not been refunded. Open Details to refund it.` })
      }
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The order could not be updated.') })
    } finally {
      setUpdating(null)
    }
  }

  const openDetail = async (order: AdminOrder) => {
    setLoadingDetail(order.number)
    try {
      setDetail(await api.admin.getOrder(order.number))
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'Order detail could not be loaded.') })
    } finally {
      setLoadingDetail(null)
    }
  }

  return (
    <section>
      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <button
              key={f.value || 'all'}
              onClick={() => onFilter(f.value)}
              className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition duration-300 ${
                active ? 'bg-[#1b261b] text-white shadow-md' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10 hover:text-[#1b261b] hover:ring-[#8bb56e]'
              }`}
            >
              {f.label}
              <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-[#1b261b]/[0.06]'}`}>{count(f.value)}</span>
            </button>
          )
        })}
      </div>

      {loading && orders.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className={cardClass}>
          <Empty title={filter ? 'Nothing here right now' : 'No orders yet'}>{filter ? 'Orders appear in this list as they reach this stage.' : 'New orders show up here as soon as they are paid.'}</Empty>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((order, i) => (
            <article
              key={order.number}
              style={{ '--i': Math.min(i, 10) } as CSSProperties}
              className={`adm-rise flex flex-col justify-between gap-4 p-4 sm:p-5 lg:flex-row lg:items-center ${cardClass}`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <Link to={`/order/${order.number}`} className="font-mono text-sm font-bold text-[#1b261b] hover:text-[#4a7333]">
                    {order.number}
                  </Link>
                  <StatusPill status={order.status} />
                </div>
                <p className="mt-1.5 text-xs text-[#4a584a]">
                  {order.email} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {order.shippingCity} ·{' '}
                  {formatShortDate(order.placedAt)}
                </p>
                {order.trackingNumber && (
                  <p className="mt-1 text-xs font-mono text-[#4a7333]">
                    🚚 {order.trackingNumber}
                    {order.shipmentStatus && order.shipmentStatus !== 'cancelled' ? ` · ${order.shipmentStatus.replaceAll('_', ' ')}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="mr-1 text-base font-bold text-[#1b261b]">{formatINR(order.total)}</span>
                <button onClick={() => void openDetail(order)} disabled={loadingDetail === order.number} className={quietButton}>
                  {loadingDetail === order.number ? <Spinner className="h-3.5 w-3.5" /> : null} Details
                </button>
                {NEXT[order.status]
                  .filter((a) => !(a.status === 'shipped' && order.shipmentStatus && order.shipmentStatus !== 'cancelled'))
                  .map((a) => (
                    <button
                      key={a.status}
                      disabled={updating === order.number}
                      onClick={() => {
                        if (a.status !== 'shipped') return void update(order, a.status)
                        setCarrier('')
                        setTracking('')
                        setShipping(order)
                      }}
                      className={a.status === 'cancelled' ? 'rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40' : primaryButton}
                    >
                      {updating === order.number && a.status !== 'cancelled' ? <Spinner className="h-3.5 w-3.5" /> : null}
                      {a.label}
                    </button>
                  ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={shipping !== null}
        onClose={() => setShipping(null)}
        size="sm"
        eyebrow="Ship order"
        title={<span className="font-mono">{shipping?.number}</span>}
        footer={
          <>
            <button onClick={() => setShipping(null)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#4a584a] hover:bg-[#1b261b]/5">
              Not yet
            </button>
            <button form="ship-form" disabled={!tracking.trim() || updating === shipping?.number} className={primaryButton}>
              {updating === shipping?.number ? <Spinner className="h-3.5 w-3.5" /> : null} Mark shipped
            </button>
          </>
        }
      >
        <form
          id="ship-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (shipping && tracking.trim()) void update(shipping, 'shipped', { carrier: carrier.trim(), trackingNumber: tracking.trim() })
          }}
          className="space-y-4"
        >
          <p className="text-sm text-[#4a584a]">The customer gets an email with these details.</p>
          <label className={labelClass}>
            Courier
            <input value={carrier} onChange={(e) => setCarrier(e.target.value)} maxLength={60} placeholder="e.g. Delhivery" className={inputClass} />
          </label>
          <label className={labelClass}>
            Tracking number
            <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={60} required className={inputClass} />
          </label>
        </form>
      </Modal>

      <OrderDetailModal detail={detail} onClose={() => setDetail(null)} onChanged={reload} />
    </section>
  )
}
