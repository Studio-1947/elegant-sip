import { useEffect, useState, type CSSProperties } from 'react'
import { adminApi, type AdminCart, type AdminCartPage, type CartStatus } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { formatDateTime } from '../../lib/dates'
import { cardClass, errorText, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Carts — what shoppers put in their cart, and whether it became a paid order.
 * Abandoned: untouched for an hour with no order. Left at payment: became an
 * order that was never paid. A guest is only known by name once they reach an
 * order; signed-in shoppers are known from their account.
 * ──────────────────────────────────────────────────────────────────────────── */

const PAGE = 50

const STATUS: Record<CartStatus, { label: string; tone: string; hint: string }> = {
  abandoned: { label: 'Abandoned', tone: 'bg-amber-100 text-amber-800', hint: 'Left over an hour ago, no order' },
  payment_abandoned: { label: 'Left at payment', tone: 'bg-rose-100 text-rose-700', hint: 'Order placed, never paid' },
  ordered: { label: 'Ordered', tone: 'bg-[#8bb56e]/20 text-[#315b26]', hint: 'Became a paid order' },
  active: { label: 'Active', tone: 'bg-sky-100 text-sky-800', hint: 'Changed in the last hour, or paying now' },
}
const ORDER: CartStatus[] = ['abandoned', 'payment_abandoned', 'ordered', 'active']
const PERIODS = [7, 30, 90] as const

function StatusBadge({ status }: { status: CartStatus }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS[status].tone}`}>{STATUS[status].label}</span>
}

const who = (cart: AdminCart) => cart.customer?.name || cart.customer?.email || 'Guest'
const itemsLine = (cart: AdminCart) => cart.items.map((i) => `${i.quantity} × ${i.productName} (${i.variantSize})`).join(', ')
/** The order total once there is one, else the cart's value. */
const value = (cart: AdminCart) => cart.order?.total ?? cart.subtotal
const whatsapp = (phone: string) => `https://wa.me/${phone.replace(/\D/g, '').replace(/^(\d{10})$/, '91$1')}`

export default function CartsPanel({ onOpenOrder }: { onOpenOrder: (number: string) => void }) {
  const { toast } = useFeedback()
  const [status, setStatus] = useState<'' | CartStatus>('abandoned')
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [offset, setOffset] = useState(0)
  // Tagged with the query it answers, so a slow older response never shows as the current one.
  const [page, setPage] = useState<(AdminCartPage & { key: string }) | null>(null)
  const [open, setOpen] = useState<AdminCart | null>(null)

  const key = `${status}|${days}|${offset}`
  const current = page?.key === key ? page : null
  const summary = current?.summary ?? page?.summary ?? null

  useEffect(() => {
    let cancelled = false
    adminApi
      .carts({ status: status || undefined, days, limit: PAGE, offset })
      .then((result) => {
        if (!cancelled) setPage({ key, ...result })
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'Carts could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [key, status, days, offset, toast])

  const choose = (next: '' | CartStatus) => {
    setStatus(next)
    setOffset(0)
  }

  return (
    <section>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {ORDER.map((s, i) => (
          <button
            key={s}
            onClick={() => choose(s)}
            style={{ '--i': i } as CSSProperties}
            className={`adm-rise p-4 text-left ${cardClass} ${status === s ? 'ring-2 ring-[#8bb56e]' : ''}`}
          >
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a584a]">{STATUS[s].label}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-[#1b261b]">{summary ? summary.counts[s] : '–'}</p>
            <p className="mt-1 text-[11px] text-[#4a584a]">{STATUS[s].hint}</p>
          </button>
        ))}
        <div style={{ '--i': 4 } as CSSProperties} className={`adm-rise col-span-2 p-4 lg:col-span-1 ${cardClass}`}>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a584a]">Left behind</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-amber-800">{summary ? formatINR(summary.abandonedValue) : '–'}</p>
          <p className="mt-1 text-[11px] text-[#4a584a]">Abandoned carts and unpaid orders</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(['', ...ORDER] as const).map((s) => (
            <button
              key={s || 'all'}
              onClick={() => choose(s)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${status === s ? 'bg-[#1b261b] text-white' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10 hover:ring-[#8bb56e]'}`}
            >
              {s ? STATUS[s].label : 'All'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-[#4a584a]">
          Active in the last
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value) as (typeof PERIODS)[number])
              setOffset(0)
            }}
            className="rounded-xl border border-[#1b261b]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1b261b] focus:border-[#8bb56e] focus:outline-none"
          >
            {PERIODS.map((d) => (
              <option key={d} value={d}>
                {d} days
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mb-4 text-xs text-[#4a584a]">
        Guests are named once they reach an order; until then only the cart is known. Carts with no order are deleted after 90 days.
      </p>

      {!current ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : current.carts.length === 0 ? (
        <div className={cardClass}>
          <Empty title={status ? `No ${STATUS[status].label.toLowerCase()} carts` : 'No carts yet'}>In the last {days} days.</Empty>
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {current.carts.map((c, i) => (
              <li key={c.id} style={{ '--i': Math.min(i, 10) } as CSSProperties} className="adm-rise">
                <button onClick={() => setOpen(c)} className={`flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between ${cardClass}`}>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-sm text-[#1b261b]">{who(c)}</b>
                      <StatusBadge status={c.status} />
                      {c.checkoutStartedAt && !c.order && <span className="text-[10px] font-semibold uppercase tracking-wider text-[#4a7333]">Reached checkout</span>}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#4a584a]">{itemsLine(c) || 'Empty'}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4a584a] sm:shrink-0 sm:justify-end sm:text-right">
                    <span>
                      <b className="text-[#1b261b]">{formatINR(value(c))}</b> · {c.itemCount} pack{c.itemCount === 1 ? '' : 's'}
                    </span>
                    <span>Last active {formatDateTime(c.lastActivityAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#4a584a]">
            <span>
              {offset + 1}–{offset + current.carts.length} of {current.total}
            </span>
            <span className="flex gap-2">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} className={quietButton}>
                ← Prev
              </button>
              <button disabled={offset + PAGE >= current.total} onClick={() => setOffset(offset + PAGE)} className={quietButton}>
                Next →
              </button>
            </span>
          </div>
        </>
      )}

      <Modal open={open !== null} onClose={() => setOpen(null)} size="lg" eyebrow={open ? STATUS[open.status].label : 'Cart'} title={open ? who(open) : 'Loading…'}>
        {!open ? (
          <div className="grid place-items-center py-10 text-[#4a7333]">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-[#1b261b]/[0.07] sm:grid-cols-2">
              {open.customer ? (
                <>
                  <p>
                    {open.customer.email ? (
                      <a href={`mailto:${open.customer.email}`} className="font-semibold text-[#4a7333] hover:underline">
                        {open.customer.email}
                      </a>
                    ) : (
                      <span className="text-[#4a584a]">No email</span>
                    )}
                    <span className="block text-xs text-[#4a584a]">{open.customer.userId ? 'Has an account' : 'Guest, from their order'}</span>
                  </p>
                  <p>
                    {open.customer.phone ? (
                      <a href={whatsapp(open.customer.phone)} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#4a7333] hover:underline">
                        {open.customer.phone} · WhatsApp
                      </a>
                    ) : (
                      <span className="text-[#4a584a]">No phone</span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-[#4a584a] sm:col-span-2">A guest who did not sign in or reach an order, so there are no contact details.</p>
              )}
              <p className="text-xs text-[#4a584a]">
                Started {formatDateTime(open.createdAt)}
                <span className="block">Last active {formatDateTime(open.lastActivityAt)}</span>
              </p>
              <p className="text-xs text-[#4a584a]">{open.checkoutStartedAt ? `Opened checkout ${formatDateTime(open.checkoutStartedAt)}` : 'Did not open checkout'}</p>
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">In the cart</h3>
              {open.items.length === 0 ? (
                <p className="mt-2 text-sm text-[#4a584a]">Empty.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#1b261b]/[0.07]">
                  {open.items.map((item) => (
                    <li key={`${item.productSlug}-${item.variantSize}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <span>
                        {item.productName} <span className="text-[#4a584a]">· {item.variantSize}</span>
                      </span>
                      <span className="text-xs text-[#4a584a]">
                        {item.quantity} × {formatINR(item.unitPrice)} = <b className="text-[#1b261b]">{formatINR(item.quantity * item.unitPrice)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 border-t border-[#1b261b]/[0.07] pt-2 text-right text-sm">
                Cart value <b>{formatINR(open.subtotal)}</b> <span className="text-xs text-[#4a584a]">(before shipping and discounts)</span>
              </p>
            </section>

            {open.order && (
              <section className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-4 text-sm ring-1 ring-[#1b261b]/[0.07]">
                <span>
                  Order{' '}
                  <button
                    onClick={() => {
                      const number = open.order!.number
                      setOpen(null)
                      onOpenOrder(number)
                    }}
                    className="font-mono font-bold text-[#4a7333] hover:underline"
                  >
                    {open.order.number}
                  </button>
                </span>
                <span className="text-xs text-[#4a584a]">
                  {open.order.status.replaceAll('_', ' ')} · <b className="text-[#1b261b]">{formatINR(open.order.total)}</b>
                </span>
              </section>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}
