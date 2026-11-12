import { useEffect, useState, type CSSProperties } from 'react'
import { adminApi, type AdminCustomer, type AdminCustomerDetail } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { formatDateTime, formatShortDate } from '../../lib/dates'
import { cardClass, dangerButton, errorText, inputClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Customers — accounts, their orders and addresses, and staff access.
 * Guest orders have no account; they are found by email in Orders.
 * ──────────────────────────────────────────────────────────────────────────── */

type RoleFilter = '' | 'customer' | 'admin'
const PAGE = 50

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'customer', label: 'Customers' },
  { value: 'admin', label: 'Staff' },
]

function Badge({ tone, children }: { tone: 'dark' | 'green' | 'amber'; children: string }) {
  const tones = { dark: 'bg-[#1b261b] text-white', green: 'bg-[#8bb56e]/20 text-[#315b26]', amber: 'bg-amber-100 text-amber-800' }
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>{children}</span>
}

export default function CustomersPanel({ onOpenOrder }: { onOpenOrder: (number: string) => void }) {
  const { toast, confirm } = useFeedback()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState<RoleFilter>('')
  const [offset, setOffset] = useState(0)
  const [reload, setReload] = useState(0)
  // Tagged with the query it answers, so a slow older response never shows as the current one.
  const [page, setPage] = useState<{ key: string; customers: AdminCustomer[]; total: number } | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null)
  const [busy, setBusy] = useState(false)

  const key = `${q}|${role}|${offset}|${reload}`
  const current = page?.key === key ? page : null

  // Debounced search: the list follows the box 300 ms after typing stops.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    adminApi
      .customers({ q: q || undefined, role: role || undefined, limit: PAGE, offset })
      .then((result) => {
        if (!cancelled) setPage({ key, ...result })
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'Customers could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [key, q, role, offset, toast])

  useEffect(() => {
    if (!openId) return
    let cancelled = false
    adminApi
      .customer(openId)
      .then((result) => {
        if (!cancelled) setDetail(result)
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'That customer could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [openId, toast])

  const shown = detail && detail.id === openId ? detail : null

  const changeRole = async (customer: AdminCustomerDetail) => {
    const giving = customer.role !== 'admin'
    const ok = await confirm({
      title: giving ? `Give ${customer.name} staff access?` : `Remove staff access from ${customer.name}?`,
      body: giving
        ? `${customer.email} will be able to open the staff page: see every order and customer, change prices and stock, cancel orders and issue refunds. Ask them to turn on two-step sign-in.`
        : `${customer.email} will lose the staff page at once. Their customer account and orders stay as they are.`,
      confirmLabel: giving ? 'Give staff access' : 'Remove staff access',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const result = await adminApi.setRole(customer.id, giving ? 'admin' : 'customer')
      setDetail({ ...customer, role: result.role })
      setReload((n) => n + 1)
      toast({ tone: 'ok', title: giving ? 'Staff access given' : 'Staff access removed', text: `${customer.name} (${customer.email}).` })
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'Staff access could not be changed.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="block w-full sm:max-w-sm">
          <span className="sr-only">Search customers</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or phone" className={inputClass} />
        </label>
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => {
                setRole(f.value)
                setOffset(0)
              }}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${role === f.value ? 'bg-[#1b261b] text-white' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10 hover:ring-[#8bb56e]'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 text-xs text-[#4a584a]">Guest checkouts have no account — find those orders by email in Orders.</p>

      {!current ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : current.customers.length === 0 ? (
        <div className={cardClass}>
          <Empty title={q ? 'No one matches that search' : 'No accounts yet'} />
        </div>
      ) : (
        <>
          <ul className="space-y-2">
            {current.customers.map((c, i) => (
              <li key={c.id} style={{ '--i': Math.min(i, 10) } as CSSProperties} className="adm-rise">
                <button
                  onClick={() => {
                    setDetail(null)
                    setOpenId(c.id)
                  }}
                  className={`flex w-full flex-col gap-2 p-4 text-left sm:flex-row sm:items-center sm:justify-between ${cardClass}`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <b className="text-sm text-[#1b261b]">{c.name}</b>
                      {c.role === 'admin' && <Badge tone="dark">Staff</Badge>}
                      {c.role === 'admin' && (c.mfaEnabled ? <Badge tone="green">2FA on</Badge> : <Badge tone="amber">No 2FA</Badge>)}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#4a584a]">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4a584a] sm:justify-end sm:text-right">
                    <span>
                      <b className="text-[#1b261b]">{c.orderCount}</b> order{c.orderCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      <b className="text-[#1b261b]">{formatINR(c.totalSpent)}</b> spent
                    </span>
                    <span>{c.lastOrderAt ? `Last order ${formatShortDate(c.lastOrderAt)}` : 'No orders'}</span>
                    <span>Joined {formatShortDate(c.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 text-xs text-[#4a584a]">
            <span>
              {offset + 1}–{offset + current.customers.length} of {current.total}
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

      <Modal
        open={openId !== null}
        onClose={() => setOpenId(null)}
        size="lg"
        eyebrow={shown?.role === 'admin' ? 'Staff account' : 'Customer'}
        title={shown?.name ?? 'Loading…'}
        footer={
          shown ? (
            <button disabled={busy} onClick={() => void changeRole(shown)} className={shown.role === 'admin' ? dangerButton : primaryButton}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
              {shown.role === 'admin' ? 'Remove staff access' : 'Give staff access'}
            </button>
          ) : undefined
        }
      >
        {!shown ? (
          <div className="grid place-items-center py-10 text-[#4a7333]">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 rounded-2xl bg-white p-4 text-sm ring-1 ring-[#1b261b]/[0.07] sm:grid-cols-2">
              <p>
                <a href={`mailto:${shown.email}`} className="font-semibold text-[#4a7333] hover:underline">
                  {shown.email}
                </a>
                <span className="block text-xs text-[#4a584a]">{shown.emailVerified ? 'Email confirmed' : 'Email not confirmed'}</span>
              </p>
              <p>
                {shown.phone ?? <span className="text-[#4a584a]">No phone</span>}
                <span className="block text-xs text-[#4a584a]">Joined {formatDateTime(shown.createdAt)}</span>
              </p>
              <p>
                <b>{shown.orderCount}</b> paid order{shown.orderCount === 1 ? '' : 's'} · <b>{formatINR(shown.totalSpent)}</b>
              </p>
              {shown.role === 'admin' && <p className="text-xs text-[#4a584a]">Two-step sign-in: {shown.mfaEnabled ? 'on' : 'off — ask them to turn it on'}</p>}
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">Orders</h3>
              {shown.orders.length === 0 ? (
                <p className="mt-2 text-sm text-[#4a584a]">No orders yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-[#1b261b]/[0.07]">
                  {shown.orders.map((o) => (
                    <li key={o.number} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <button
                        onClick={() => {
                          setOpenId(null)
                          onOpenOrder(o.number)
                        }}
                        className="font-mono font-bold text-[#4a7333] hover:underline"
                      >
                        {o.number}
                      </button>
                      <span className="text-xs text-[#4a584a]">
                        {o.status.replaceAll('_', ' ')} · {formatShortDate(o.placedAt)} · <b className="text-[#1b261b]">{formatINR(o.total)}</b>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07]">
              <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">Saved addresses</h3>
              {shown.addresses.length === 0 ? (
                <p className="mt-2 text-sm text-[#4a584a]">None saved.</p>
              ) : (
                <ul className="mt-2 grid gap-3 sm:grid-cols-2">
                  {shown.addresses.map((a, i) => (
                    <li key={`${a.label}-${i}`} className="rounded-xl bg-[#f4f6f1] p-3 text-xs leading-relaxed text-[#1b261b]">
                      <b className="block text-[10px] uppercase tracking-wider text-[#4a584a]">{a.label}</b>
                      {a.name}
                      <br />
                      {a.line1}
                      <br />
                      {a.city}
                      {a.state ? `, ${a.state}` : ''} {a.postalCode}
                      {a.phone ? (
                        <>
                          <br />
                          {a.phone}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>
    </section>
  )
}
