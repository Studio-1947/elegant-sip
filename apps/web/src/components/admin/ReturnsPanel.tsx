import { useState, type CSSProperties } from 'react'
import { api, type AdminReturnRequest } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { formatShortDate } from '../../lib/dates'
import { cardClass, errorText, inputClass, labelClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner } from './ui/controls'

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-800',
  received: 'bg-green-100 text-green-800',
  rejected: 'bg-stone-200 text-stone-600',
}

type Decision = 'approved' | 'rejected' | 'received'

const EXPLAIN: Record<Decision, (item: AdminReturnRequest) => string> = {
  approved: (item) =>
    item.type === 'cancellation'
      ? 'The order is cancelled and its stock goes back on sale. The customer is emailed that the refund will follow — then refund it from the order.'
      : 'The customer is emailed to send the tea back. Mark it received when the parcel arrives.',
  rejected: () => 'The customer is emailed that it was not accepted, with your note. They can send a new request from their order page.',
  received: () => 'The packs go back into stock and the customer is emailed that the refund will follow — then refund it from the order.',
}

/** Customer return and cancellation requests: open ones first, each decision emailed to the customer. */
export default function ReturnsPanel({
  requests,
  onChanged,
  onOpen,
}: {
  requests: AdminReturnRequest[]
  onChanged: () => void
  onOpen: (number: string) => void
}) {
  const { toast } = useFeedback()
  const [show, setShow] = useState<'open' | 'all'>('open')
  const [deciding, setDeciding] = useState<{ item: AdminReturnRequest; status: Decision } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const open = requests.filter((r) => r.status === 'requested' || (r.status === 'approved' && r.type === 'return'))
  const shown = show === 'open' ? open : requests

  const decide = async () => {
    if (!deciding) return
    const { item, status } = deciding
    setBusy(true)
    try {
      const result = await api.admin.updateReturnRequest(item.id, { status, ...(note.trim() ? { staffNote: note.trim() } : {}) })
      setDeciding(null)
      toast({
        tone: 'ok',
        title: `${item.number} · ${status}`,
        text: `${result.restocked ? 'Stock put back. ' : ''}${result.notified ? `${item.email} was emailed.` : 'The customer email is queued for a retry.'}`,
      })
      if (result.refundDue) toast({ tone: 'info', title: 'Refund due', text: `Open ${item.number} and refund the payment.` })
      onChanged()
      if (result.refundDue) onOpen(item.number)
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The request could not be updated.') })
    } finally {
      setBusy(false)
    }
  }

  const start = (item: AdminReturnRequest, status: Decision) => {
    setNote('')
    setDeciding({ item, status })
  }

  return (
    <section>
      <div className="mb-4 flex gap-2">
        {(['open', 'all'] as const).map((value) => (
          <button
            key={value}
            onClick={() => setShow(value)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${show === value ? 'bg-[#1b261b] text-white' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10'}`}
          >
            {value === 'open' ? `Needs action (${open.length})` : `All (${requests.length})`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className={cardClass}>
          <Empty title={show === 'open' ? 'Nothing waiting' : 'No customer requests'}>Returns and cancellations that customers ask for appear here.</Empty>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((item, i) => (
            <article key={item.id} style={{ '--i': Math.min(i, 10) } as CSSProperties} className={`adm-rise flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between ${cardClass}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpen(item.number)} className="font-mono text-sm font-bold hover:text-[#4a7333]">
                    {item.number}
                  </button>
                  <span className="rounded-full bg-[#1b261b]/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4a584a]">{item.type}</span>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[item.status] ?? 'bg-stone-100'}`}>{item.status}</span>
                  <span className="text-[11px] text-[#4a584a]">order {item.orderStatus.replaceAll('_', ' ')}</span>
                </div>
                <p className="mt-1.5 text-xs text-[#4a584a]">
                  <b className="font-semibold text-[#1b261b]">{item.customerName}</b> · {item.email} · {formatINR(item.total)} · requested {formatShortDate(item.requestedAt)}
                </p>
                <p className="mt-2 max-w-2xl text-sm text-[#1b261b]">“{item.reason}”</p>
                {item.staffNote && <p className="mt-1 text-xs text-[#4a584a]">Our note: {item.staffNote}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {item.status === 'requested' && (
                  <>
                    <button onClick={() => start(item, 'rejected')} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50">
                      Reject…
                    </button>
                    <button onClick={() => start(item, 'approved')} className={primaryButton}>
                      Approve…
                    </button>
                  </>
                )}
                {item.status === 'approved' && item.type === 'return' && (
                  <button onClick={() => start(item, 'received')} className={primaryButton}>
                    Mark received…
                  </button>
                )}
                {(item.status === 'received' || (item.status === 'approved' && item.type === 'cancellation')) && (
                  <button onClick={() => onOpen(item.number)} className={quietButton}>
                    Refund in order →
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={deciding !== null}
        onClose={() => setDeciding(null)}
        size="sm"
        eyebrow={deciding ? `${deciding.item.type} · ${deciding.item.number}` : ''}
        title={deciding?.status === 'rejected' ? 'Reject this request?' : deciding?.status === 'received' ? 'Return received?' : 'Approve this request?'}
        footer={
          <>
            <button onClick={() => setDeciding(null)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#4a584a] hover:bg-[#1b261b]/5">
              Back
            </button>
            <button onClick={() => void decide()} disabled={busy} className={deciding?.status === 'rejected' ? 'inline-flex items-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-800 disabled:opacity-40' : primaryButton}>
              {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
              {deciding?.status === 'rejected' ? 'Reject and email' : deciding?.status === 'received' ? 'Mark received and email' : 'Approve and email'}
            </button>
          </>
        }
      >
        {deciding && (
          <div className="space-y-4">
            <p className="rounded-xl bg-[#f4f6f1] p-3 text-sm">“{deciding.item.reason}”</p>
            <p className="text-sm text-[#4a584a]">{EXPLAIN[deciding.status](deciding.item)}</p>
            <label className={labelClass}>
              Note to the customer {deciding.status === 'rejected' ? '(recommended)' : '(optional)'}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} className={`${inputClass} resize-y`} />
            </label>
          </div>
        )}
      </Modal>
    </section>
  )
}
