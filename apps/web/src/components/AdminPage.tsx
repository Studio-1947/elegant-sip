import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { api, type AdminConfig, type AdminOrder, type AdminOrderStatus, type AdminReturnRequest, type LowStockVariant } from '../lib/api'
import { Link, useDocumentMeta } from '../lib/router'
import OrdersPanel from './admin/OrdersPanel'
import ProductsPanel from './admin/ProductsPanel'
import ReturnsPanel from './admin/ReturnsPanel'
import RestockForm from './admin/RestockForm'
import ReviewQueue from './admin/ReviewQueue'
import MfaNudge from './admin/MfaNudge'
import GardenEditor from './admin/GardenEditor'
import StoreSettings from './admin/StoreSettings'
import EmailOutbox from './admin/EmailOutbox'
import AuditLog from './admin/AuditLog'
import { cardClass, errorText, quietButton } from './admin/adminUi'
import { FeedbackProvider, useFeedback } from './admin/ui/Feedback'
import Modal from './admin/ui/Modal'
import { Spinner, Tabs } from './admin/ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Staff dashboard. Orders, returns and the product catalogue, behind the
 * admin role (the API checks it again on every request).
 * ──────────────────────────────────────────────────────────────────────────── */

type Section = 'orders' | 'returns' | 'products' | 'reviews' | 'gardens' | 'settings'

function Gate({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[#f4f6f1] px-6 pt-24 text-[#1b261b]">
      <div className="adm-pop w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-[0_30px_70px_-30px_rgba(15,22,15,0.35)] ring-1 ring-black/5">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#8bb56e]/15 text-2xl">🔒</span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </div>
    </div>
  )
}

function Stat({ label, value, hint, tone, onClick, index }: { label: string; value: number; hint: string; tone: 'green' | 'violet' | 'amber' | 'rose'; onClick: () => void; index: number }) {
  const tones = {
    green: 'from-[#8bb56e]/25 text-[#315b26]',
    violet: 'from-violet-200/60 text-violet-800',
    amber: 'from-amber-200/60 text-amber-800',
    rose: 'from-rose-200/60 text-rose-800',
  }
  return (
    <button onClick={onClick} style={{ '--i': index } as CSSProperties} className={`adm-rise group relative overflow-hidden p-4 text-left sm:p-5 ${cardClass}`}>
      <span className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br to-transparent transition-transform duration-500 group-hover:scale-125 ${tones[tone]}`} />
      <p className="relative text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a584a]">{label}</p>
      <p className={`relative mt-2 text-3xl font-bold tabular-nums ${value > 0 ? tones[tone].split(' ')[1] : 'text-[#1b261b]/30'}`}>{value}</p>
      <p className="relative mt-1 text-[11px] text-[#4a584a]">{hint} →</p>
    </button>
  )
}

function Dashboard() {
  const { user } = useAuth()
  const { toast } = useFeedback()
  const [section, setSection] = useState<Section>('orders')
  const [orderFilter, setOrderFilter] = useState<'' | AdminOrderStatus>('')
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [config, setConfig] = useState<AdminConfig | null>(null)
  const [requests, setRequests] = useState<AdminReturnRequest[]>([])
  const [lowStock, setLowStock] = useState<LowStockVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [statusOpen, setStatusOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)

  // The latest 200 orders, filtered in the browser so the filter chips and
  // counts are instant. `loading` starts true; Refresh sets it first.
  const load = useCallback(
    () =>
      // Low stock uses the threshold from Shop settings.
      Promise.all([api.admin.listOrders(undefined, 200), api.admin.config(), api.admin.listReturnRequests(), api.admin.lowStock()])
        .then(([o, c, r, l]) => {
          setOrders(o.orders)
          setConfig(c)
          setRequests(r.requests)
          setLowStock(l.variants)
        })
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Could not load the dashboard.') }))
        .finally(() => setLoading(false)),
    [toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const refreshLowStock = useCallback(
    () =>
      api.admin
        .lowStock()
        .then((r) => setLowStock(r.variants))
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'The low-stock list could not be refreshed.') })),
    [toast],
  )

  const refresh = () => {
    setLoading(true)
    void load()
  }

  const toPack = orders.filter((o) => o.status === 'paid').length
  const toShip = orders.filter((o) => o.status === 'packed').length
  const awaiting = requests.filter((r) => r.status === 'requested').length

  const checks = config
    ? [
        { label: 'Payments', ready: config.paymentsLive, value: config.paymentsLive ? 'Razorpay live' : config.paymentProvider === 'razorpay' ? 'Razorpay test mode' : `${config.paymentProvider} — not live` },
        { label: 'Customer email', ready: config.emailConfigured, value: config.emailConfigured ? 'Configured' : 'Not configured' },
        { label: 'GST invoice', ready: config.gstinConfigured, value: config.gstinConfigured ? 'GSTIN configured' : 'GSTIN needed' },
        { label: 'Shipping', ready: config.shippingLive, value: config.shippingLive ? 'Shiprocket live' : config.shippingProvider === 'fake' ? 'Shiprocket test mode' : 'Manual tracking' },
        {
          label: 'Meta server events',
          ready: config.metaServerEvents === 'live' && !config.metaServerEventsError,
          value: config.metaServerEventsError ? `Failing: ${config.metaServerEventsError}` : config.metaServerEvents === 'live' ? 'Conversions API live' : config.metaServerEvents === 'test' ? 'Test events only' : 'Not configured',
        },
        { label: 'Seller location', ready: true, value: config.sellerState },
      ]
    : []
  const ready = checks.filter((c) => c.ready).length

  const showOrders = (filter: '' | AdminOrderStatus) => {
    setOrderFilter(filter)
    setSection('orders')
  }

  return (
    <div className="min-h-screen bg-[#f4f6f1] px-4 pb-24 pt-28 text-[#1b261b] sm:px-8 md:pt-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <header className="adm-rise mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#1b261b] px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#8bb56e]" /> Staff only
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋</h1>
            <p className="mt-1.5 text-sm text-[#4a584a]">Here's what needs you today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {config && (
              <button onClick={() => setStatusOpen(true)} className={quietButton}>
                <span className={`h-2 w-2 rounded-full ${ready === checks.length ? 'bg-[#4a7333]' : 'bg-amber-500'}`} />
                System status · {ready}/{checks.length}
              </button>
            )}
            <button onClick={refresh} disabled={loading} className={quietButton}>
              {loading ? <Spinner className="h-3.5 w-3.5" /> : <span aria-hidden="true">↻</span>} Refresh
            </button>
          </div>
        </header>

        <MfaNudge />

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat index={0} label="To pack" value={toPack} hint="Paid orders" tone="green" onClick={() => showOrders('paid')} />
          <Stat index={1} label="To ship" value={toShip} hint="Packed orders" tone="violet" onClick={() => showOrders('packed')} />
          <Stat index={2} label="Requests" value={awaiting} hint="Returns & cancellations" tone="amber" onClick={() => setSection('returns')} />
          <Stat index={3} label="Low stock" value={lowStock.length} hint="At your stock threshold" tone="rose" onClick={() => setStockOpen(true)} />
        </div>

        <div className="no-scrollbar -mx-1 mb-6 overflow-x-auto px-1">
          <Tabs<Section>
            value={section}
            onChange={setSection}
            items={[
              { value: 'orders', label: 'Orders', badge: toPack + toShip },
              { value: 'returns', label: 'Returns', badge: awaiting },
              { value: 'products', label: 'Products' },
              { value: 'reviews', label: 'Reviews' },
              { value: 'gardens', label: 'Gardens' },
              { value: 'settings', label: 'Settings' },
            ]}
          />
        </div>

        <div key={section} className="adm-rise">
          {section === 'orders' && (
            <OrdersPanel
              orders={orders}
              loading={loading}
              reload={refresh}
              filter={orderFilter}
              onFilter={setOrderFilter}
              onUpdated={(number, patch) => setOrders((all) => all.map((o) => (o.number === number ? { ...o, ...patch } : o)))}
            />
          )}
          {section === 'reviews' && <ReviewQueue />}
          {section === 'gardens' && <GardenEditor />}
          {section === 'settings' && (
            <div className="space-y-8">
              <StoreSettings onSaved={() => void refreshLowStock()} />
              <EmailOutbox />
              <AuditLog />
            </div>
          )}
          {section === 'returns' && (
            <ReturnsPanel requests={requests} onUpdated={(id, status) => setRequests((all) => all.map((r) => (r.id === id ? { ...r, status } : r)))} />
          )}
        </div>
        {/* Kept mounted so the product list is not refetched on every tab switch. */}
        <div hidden={section !== 'products'} className={section === 'products' ? 'adm-rise' : ''}>
          <ProductsPanel />
        </div>
      </div>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} size="sm" eyebrow="Setup" title="System status">
        <ul className="space-y-2">
          {checks.map((c, i) => (
            <li key={c.label} style={{ '--i': i } as CSSProperties} className="adm-rise flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-[#1b261b]/[0.07]">
              <span className="text-sm text-[#4a584a]">{c.label}</span>
              <span className={`flex items-center gap-2 text-sm font-semibold ${c.ready ? 'text-[#315b26]' : 'text-amber-700'}`}>
                <span className={`h-2 w-2 rounded-full ${c.ready ? 'bg-[#4a7333]' : 'bg-amber-500'}`} />
                {c.value}
              </span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={stockOpen}
        onClose={() => setStockOpen(false)}
        size="sm"
        eyebrow="Inventory"
        title={lowStock.length ? `${lowStock.length} pack${lowStock.length === 1 ? '' : 's'} running low` : 'Stock looks healthy'}
        footer={
          <button
            onClick={() => {
              setStockOpen(false)
              setSection('products')
            }}
            className={quietButton}
          >
            Update stock in Products →
          </button>
        }
      >
        {lowStock.length === 0 ? (
          <p className="text-sm text-[#4a584a]">Every pack is above the low-stock threshold set in Settings.</p>
        ) : (
          <ul className="space-y-2">
            {lowStock.map((v, i) => (
              <li key={`${v.productSlug}-${v.size}`} style={{ '--i': i } as CSSProperties} className="adm-rise flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-[#1b261b]/[0.07]">
                <span className="text-sm">
                  {v.productName} <span className="text-[#4a584a]">· {v.size}</span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  <b className={`rounded-lg px-2 py-0.5 font-mono text-sm ${v.stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{v.stock} left</b>
                  <RestockForm
                    productSlug={v.productSlug}
                    productName={v.productName}
                    size={v.size}
                    onRestocked={(message) => {
                      toast({ tone: 'ok', title: 'Restocked', text: message })
                      void refreshLowStock()
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </div>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  useDocumentMeta('Staff Operations | Elegant Sip', 'Restricted staff order operations.', { noindex: true })

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f4f6f1] text-[#4a7333]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!user) {
    return (
      <Gate title="Staff access">
        <p className="mt-2 text-sm text-[#4a584a]">Sign in with a staff account to manage orders and products.</p>
        <Link to="/account" className="mt-6 inline-flex rounded-xl bg-[#1b261b] px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition hover:-translate-y-px hover:bg-[#2c3d2c]">
          Sign in
        </Link>
      </Gate>
    )
  }

  if (user.role !== 'admin') {
    return (
      <Gate title="Restricted area">
        <p className="mt-2 text-sm text-[#4a584a]">This area is only for authorised Elegant Sip staff.</p>
        <Link to="/account" className="mt-6 inline-flex rounded-xl px-6 py-3 text-xs font-bold uppercase tracking-widest ring-1 ring-[#1b261b]/15 transition hover:ring-[#8bb56e]">
          Back to account
        </Link>
      </Gate>
    )
  }

  return (
    <FeedbackProvider>
      <Dashboard />
    </FeedbackProvider>
  )
}
