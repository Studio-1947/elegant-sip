import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api, type AdminOrder, type AdminOrderPage, type AdminOrderStatus } from '../../lib/api'
import { downloadOrdersCsv } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { formatShortDate } from '../../lib/dates'
import { cardClass, errorText, inputClass, labelClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * The order queue: searched, filtered and paged on the server, so it works the
 * same at 20 orders or 20,000. Opening an order is the parent's job (the
 * detail modal is shared with Returns and Customers).
 * ──────────────────────────────────────────────────────────────────────────── */

type Action = 'packed' | 'shipped' | 'delivered' | 'cancelled'
const PAGE = 50

const FILTERS: Array<{ value: '' | AdminOrderStatus; label: string }> = [
  { value: '', label: 'All' },
  { value: 'paid', label: 'To pack' },
  { value: 'packed', label: 'To ship' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'pending_payment', label: 'Awaiting payment' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
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
  filter,
  onFilter,
  counts,
  refreshKey,
  onChanged,
  onOpen,
}: {
  filter: '' | AdminOrderStatus
  onFilter: (f: '' | AdminOrderStatus) => void
  /** Whole-shop counts by status, for the filter chips. */
  counts: AdminOrderPage['counts'] | null
  /** Changes when the parent wants the list reloaded. */
  refreshKey: number
  /** Something changed that affects the dashboard tiles. */
  onChanged: () => void
  onOpen: (number: string) => void
}) {
  const { toast } = useFeedback()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{ orders: AdminOrder[]; total: number } | null>(null)
  /** The query the list on screen answers; the list is loading until it matches the current one. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [shipping, setShipping] = useState<AdminOrder | null>(null)
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Search waits for typing to pause; any filter change goes back to page one.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(search.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(id)
  }, [search])

  const query = { status: filter || undefined, q: q || undefined, from: from || undefined, to: to || undefined }
  const key = JSON.stringify({ ...query, offset, refreshKey })
  const loading = loadedKey !== key
  const load = useCallback(
    (forKey: string) =>
      api.admin
        .listOrders({ status: filter || undefined, q: q || undefined, from: from || undefined, to: to || undefined, limit: PAGE, offset })
        .then((r) => setPage({ orders: r.orders, total: r.total }))
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Could not load orders.') }))
        .finally(() => setLoadedKey(forKey)),
    [filter, q, from, to, offset, toast],
  )

  useEffect(() => {
    void load(key)
  }, [load, key])

  const total = counts ? Object.values(counts).reduce((a, n) => a + n, 0) : null
  const filtered = Boolean(q || from || to)

  const update = async (order: AdminOrder, status: Action, extra: { carrier?: string; trackingNumber?: string; reason?: string; notifyCustomer?: boolean } = {}) => {
    setUpdating(order.number)
    try {
      const result = await api.admin.updateOrder(order.number, {
        status,
        ...(extra.carrier ? { trackingCarrier: extra.carrier } : {}),
        ...(extra.trackingNumber ? { trackingNumber: extra.trackingNumber } : {}),
        ...(status === 'cancelled' ? { notifyCustomer: extra.notifyCustomer ?? true, ...(extra.reason ? { reason: extra.reason } : {}) } : {}),
      })
      setShipping(null)
      setCancelling(null)
      const mailed = status === 'delivered' ? 'Delivery' : status === 'cancelled' ? 'Cancellation' : 'Shipment'
      toast({ tone: 'ok', title: `${order.number} · ${status}`, text: result.notified ? `${mailed} email sent to ${order.email}.` : 'Order updated.' })
      if (result.refundDue) {
        toast({ tone: 'info', title: 'Refund still due', text: `${order.number} is cancelled but its payment has not been refunded. Open it to refund.` })
      }
      // The parent bumps refreshKey, which reloads this list.
      onChanged()
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The order could not be updated.') })
    } finally {
      setUpdating(null)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      await downloadOrdersCsv(query)
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The export could not be created.') })
    } finally {
      setExporting(false)
    }
  }

  const orders = page?.orders ?? []
  return (
    <section>
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
        <label className={labelClass}>
          Search
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order number, email, name, phone or PIN" className={inputClass} type="search" />
        </label>
        <label className={labelClass}>
          From
          <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setOffset(0) }} className={inputClass} />
        </label>
        <label className={labelClass}>
          To
          <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setOffset(0) }} className={inputClass} />
        </label>
        <button onClick={() => void exportCsv()} disabled={exporting} className={quietButton}>
          {exporting ? <Spinner className="h-3.5 w-3.5" /> : '⇩'} Export CSV
        </button>
      </div>

      <div className="no-scrollbar -mx-1 mb-5 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => {
          const active = filter === f.value
          const n = counts ? (f.value ? counts[f.value] : total) : null
          return (
            <button
              key={f.value || 'all'}
              onClick={() => {
                onFilter(f.value)
                setOffset(0)
              }}
              className={`flex flex-shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition duration-300 ${
                active ? 'bg-[#1b261b] text-white shadow-md' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10 hover:text-[#1b261b] hover:ring-[#8bb56e]'
              }`}
            >
              {f.label}
              {n !== null && <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-white/20' : 'bg-[#1b261b]/[0.06]'}`}>{n}</span>}
            </button>
          )
        })}
      </div>

      {filtered && page && (
        <p className="mb-3 text-xs text-[#4a584a]">
          {page.total} order{page.total === 1 ? '' : 's'} match.{' '}
          <button onClick={() => { setSearch(''); setFrom(''); setTo('') }} className="font-semibold text-[#4a7333] hover:underline">
            Clear search
          </button>
        </p>
      )}

      {loading && !page ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className={cardClass}>
          <Empty title={filter || filtered ? 'Nothing matches' : 'No orders yet'}>{filter || filtered ? 'Try another filter or search.' : 'New orders show up here as soon as they are placed.'}</Empty>
        </div>
      ) : (
        <div className={`space-y-3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {orders.map((order, i) => (
            <article key={order.number} style={{ '--i': Math.min(i, 10) } as CSSProperties} className={`adm-rise flex flex-col justify-between gap-4 p-4 sm:p-5 lg:flex-row lg:items-center ${cardClass}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <button onClick={() => onOpen(order.number)} className="font-mono text-sm font-bold text-[#1b261b] hover:text-[#4a7333]">
                    {order.number}
                  </button>
                  <StatusPill status={order.status} />
                  {order.hasRequest && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-800">Request open</span>}
                </div>
                <p className="mt-1.5 text-xs text-[#4a584a]">
                  <b className="font-semibold text-[#1b261b]">{order.customerName}</b> · {order.email} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'} · {order.shippingCity} · {formatShortDate(order.placedAt)}
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
                <button onClick={() => onOpen(order.number)} className={quietButton}>
                  Open
                </button>
                {NEXT[order.status]
                  .filter((a) => !(a.status === 'shipped' && order.shipmentStatus && order.shipmentStatus !== 'cancelled'))
                  .map((a) => (
                    <button
                      key={a.status}
                      disabled={updating === order.number}
                      onClick={() => {
                        if (a.status === 'shipped') {
                          setCarrier('')
                          setTracking('')
                          return setShipping(order)
                        }
                        if (a.status === 'cancelled') {
                          setCancelReason('')
                          setNotify(order.status !== 'pending_payment')
                          return setCancelling(order)
                        }
                        void update(order, a.status)
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

      {page && page.total > PAGE && (
        <div className="mt-5 flex items-center justify-between gap-3 text-xs text-[#4a584a]">
          <span>
            {offset + 1}–{Math.min(offset + PAGE, page.total)} of {page.total}
          </span>
          <span className="flex gap-2">
            <button onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={offset === 0 || loading} className={quietButton}>
              ← Newer
            </button>
            <button onClick={() => setOffset(offset + PAGE)} disabled={offset + PAGE >= page.total || loading} className={quietButton}>
              Older →
            </button>
          </span>
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
          <p className="text-sm text-[#4a584a]">The customer gets an email with these details. To book a courier instead, open the order.</p>
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

      <Modal
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        size="sm"
        eyebrow="Cancel order"
        title={<span className="font-mono">{cancelling?.number}</span>}
        footer={
          <>
            <button onClick={() => setCancelling(null)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#4a584a] hover:bg-[#1b261b]/5">
              Keep order
            </button>
            <button form="cancel-form" disabled={updating === cancelling?.number} className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-rose-800 disabled:opacity-40">
              {updating === cancelling?.number ? <Spinner className="h-3.5 w-3.5" /> : null} Cancel order
            </button>
          </>
        }
      >
        <form
          id="cancel-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (cancelling) void update(cancelling, 'cancelled', { reason: cancelReason.trim(), notifyCustomer: notify })
          }}
          className="space-y-4"
        >
          <p className="text-sm text-[#4a584a]">
            {cancelling?.email} · {cancelling ? formatINR(cancelling.total) : ''}. The stock goes back on sale. Cancelling does not refund: if it was paid, refund it from the order afterwards.
          </p>
          {cancelling?.status !== 'pending_payment' && (
            <>
              <label className="flex items-center gap-2 text-sm text-[#1b261b]">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="h-4 w-4 accent-[#4a7333]" />
                Email the customer that it is cancelled
              </label>
              <label className={labelClass}>
                Reason for the customer (optional)
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={300} disabled={!notify} placeholder="e.g. This lot has sold out." className={inputClass} />
              </label>
            </>
          )}
        </form>
      </Modal>
    </section>
  )
}
