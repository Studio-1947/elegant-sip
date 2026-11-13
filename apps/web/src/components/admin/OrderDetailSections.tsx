import { useState, type ReactNode } from 'react'
import type { AdminAddress, AdminOrderDetail } from '../../lib/api'
import { adminApi } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { formatDateTime } from '../../lib/dates'
import { errorText, inputClass, labelClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Spinner } from './ui/controls'

/* Pieces of the order detail modal: cards, the money table, the address
   editor and staff notes. */

export function Card({ title, action, children, className = '' }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-[#1b261b]/[0.07] ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#4a7333]">{title}</h3>
        {action}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-[#1b261b]">{children}</div>
    </section>
  )
}

export function AddressLines({ address, phone }: { address: AdminAddress; phone?: string | null }) {
  return (
    <>
      <b>{address.name}</b>
      <br />
      {address.line1}
      <br />
      {address.city}
      {address.state ? `, ${address.state}` : ''} {address.postalCode}
      <br />
      <span className="text-[#4a584a]">{address.country}</span>
      {phone !== undefined && (
        <>
          <br />
          {phone ?? <span className="text-[#4a584a]">No phone supplied</span>}
        </>
      )}
    </>
  )
}

/** Delivery address with an inline editor while nothing is booked with a courier. */
export function DeliveryCard({ detail, onSaved }: { detail: AdminOrderDetail; onSaved: () => void }) {
  const { toast } = useFeedback()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ ...detail.shipping, state: detail.shipping.state ?? '', phone: detail.phone ?? '' })
  const field = (key: keyof typeof form, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <label className={labelClass}>
      {label}
      <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className={inputClass} {...extra} />
    </label>
  )
  const save = async () => {
    setBusy(true)
    try {
      await adminApi.updateAddress(detail.number, {
        name: form.name.trim(),
        line1: form.line1.trim(),
        city: form.city.trim(),
        postalCode: form.postalCode.trim(),
        state: form.state.trim() || null,
        phone: form.phone.trim() || null,
      })
      toast({ tone: 'ok', text: `Delivery address for ${detail.number} updated.` })
      setEditing(false)
      onSaved()
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The address could not be saved.') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card
      title="Deliver to"
      action={
        detail.addressEditable && !editing ? (
          <button onClick={() => setEditing(true)} className="text-xs font-semibold text-[#4a7333] hover:underline">
            Edit
          </button>
        ) : null
      }
    >
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
          className="grid gap-2 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">{field('name', 'Name', { required: true, maxLength: 120 })}</div>
          <div className="sm:col-span-2">{field('line1', 'Address', { required: true, maxLength: 300 })}</div>
          {field('city', 'City', { required: true, maxLength: 80 })}
          {field('postalCode', 'PIN code', { required: true, inputMode: 'numeric', pattern: '\\d{6}', maxLength: 6 })}
          {field('state', 'State', { maxLength: 80 })}
          {field('phone', 'Phone', { inputMode: 'tel', maxLength: 16 })}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setEditing(false)} className={quietButton}>
              Cancel
            </button>
            <button disabled={busy} className={primaryButton}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : null} Save address
            </button>
          </div>
        </form>
      ) : (
        <>
          <AddressLines address={detail.shipping} phone={detail.phone} />
          {!detail.addressEditable && !['cancelled', 'refunded'].includes(detail.status) && (
            <p className="mt-2 text-[11px] text-[#4a584a]">Booked with the courier — change it with them.</p>
          )}
        </>
      )}
    </Card>
  )
}

/** Lines with prices, then the totals as charged. */
export function MoneyCard({ detail }: { detail: AdminOrderDetail }) {
  const row = (label: ReactNode, value: string, strong = false) => (
    <div className={`flex justify-between gap-4 py-1 ${strong ? 'font-bold' : ''}`}>
      <span className={strong ? '' : 'text-[#4a584a]'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
  return (
    <Card title="Items and money" className="mt-4">
      <ul className="divide-y divide-[#1b261b]/[0.07]">
        {detail.items.map((item, index) => (
          <li key={`${item.sku}-${index}`} className="flex items-center justify-between gap-4 py-2.5">
            <span className="min-w-0">
              {item.productName} <span className="text-[#4a584a]">· {item.variantSize}</span>
              <span className="block font-mono text-[10px] text-[#4a584a]">{item.sku}</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-3 tabular-nums">
              <span className="text-xs text-[#4a584a]">
                {formatINR(item.unitPrice)} × {item.quantity}
              </span>
              <b className="w-20 text-right">{formatINR(item.lineTotal)}</b>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 border-t border-[#1b261b]/[0.07] pt-2 text-sm">
        {row('Subtotal', formatINR(detail.subtotal))}
        {detail.discount > 0 && row(`Discount${detail.couponCode ? ` (${detail.couponCode})` : ''}`, `− ${formatINR(detail.discount)}`)}
        {row(`Shipping (${detail.shippingMethod})`, detail.shippingFee === 0 ? 'Free' : formatINR(detail.shippingFee))}
        {row('Total charged', formatINR(detail.total), true)}
        {row('GST included', formatINR(detail.tax))}
        {detail.refunded > 0 && (
          <>
            {row(<span className="text-rose-700">Refunded</span>, `− ${formatINR(detail.refunded)}`)}
            {row('Kept', formatINR(detail.total - detail.refunded), true)}
          </>
        )}
      </div>
    </Card>
  )
}

export function PaymentCard({ detail }: { detail: AdminOrderDetail }) {
  const p = detail.payment
  return (
    <Card title="Payment">
      {!p ? (
        <span className="text-[#4a584a]">No payment started.</span>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
          <dt className="text-[#4a584a]">Status</dt>
          <dd className="font-semibold">{p.status}</dd>
          <dt className="text-[#4a584a]">Method</dt>
          <dd>{p.method ?? '—'}</dd>
          <dt className="text-[#4a584a]">Amount</dt>
          <dd>{formatINR(p.amount)}</dd>
          <dt className="text-[#4a584a]">{p.provider === 'razorpay' ? 'Razorpay ID' : 'Payment ID'}</dt>
          <dd className="break-all font-mono text-xs">{p.providerPaymentId ?? <span className="text-[#4a584a]">not paid</span>}</dd>
          {p.capturedAt && (
            <>
              <dt className="text-[#4a584a]">Paid</dt>
              <dd>{formatDateTime(p.capturedAt)}</dd>
            </>
          )}
          {detail.invoiceNumber && (
            <>
              <dt className="text-[#4a584a]">Invoice</dt>
              <dd className="font-mono text-xs">{detail.invoiceNumber}</dd>
            </>
          )}
        </dl>
      )}
    </Card>
  )
}

/** Internal notes; never shown to the customer. */
export function StaffNotes({ detail, onSaved }: { detail: AdminOrderDetail; onSaved: () => void }) {
  const { toast } = useFeedback()
  const [text, setText] = useState(detail.staffNotes ?? '')
  const [busy, setBusy] = useState(false)
  const dirty = text.trim() !== (detail.staffNotes ?? '')
  const save = async () => {
    setBusy(true)
    try {
      await adminApi.staffNotes(detail.number, text.trim())
      toast({ tone: 'ok', text: 'Staff notes saved.' })
      onSaved()
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The notes could not be saved.') })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card title="Staff notes · not shown to the customer" className="mt-4">
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. Gift — leave the invoice out of the box" className={`${inputClass} mt-0 resize-y`} aria-label="Staff notes" />
      <div className="mt-2 flex justify-end">
        <button onClick={() => void save()} disabled={!dirty || busy} className={quietButton}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : null} {dirty ? 'Save notes' : 'Saved ✓'}
        </button>
      </div>
    </Card>
  )
}
