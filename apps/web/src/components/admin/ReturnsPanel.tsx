import { useState, type CSSProperties } from 'react'
import { api, type AdminReturnRequest } from '../../lib/api'
import { formatShortDate } from '../../lib/dates'
import { cardClass, errorText, primaryButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Empty, Spinner } from './ui/controls'

const STATUS_TONE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-sky-100 text-sky-800',
  received: 'bg-green-100 text-green-800',
  rejected: 'bg-stone-200 text-stone-600',
}

/** Customer return and cancellation requests, newest first. */
export default function ReturnsPanel({
  requests,
  onUpdated,
}: {
  requests: AdminReturnRequest[]
  onUpdated: (id: string, status: AdminReturnRequest['status']) => void
}) {
  const { toast, confirm } = useFeedback()
  const [updating, setUpdating] = useState<string | null>(null)

  const update = async (item: AdminReturnRequest, status: 'approved' | 'rejected' | 'received') => {
    if (status === 'rejected') {
      const ok = await confirm({ title: `Reject request for ${item.number}?`, body: `“${item.reason}”`, confirmLabel: 'Reject request', danger: true })
      if (!ok) return
    }
    setUpdating(item.id)
    try {
      const result = await api.admin.updateReturnRequest(item.id, { status })
      onUpdated(item.id, status)
      toast({
        tone: 'ok',
        title: `${item.number} · ${status}`,
        text: result.restocked ? 'Return received and the stock was put back.' : 'Request updated.',
      })
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'The request could not be updated.') })
    } finally {
      setUpdating(null)
    }
  }

  if (requests.length === 0) {
    return (
      <div className={cardClass}>
        <Empty title="No customer requests">Returns and cancellations that customers ask for appear here.</Empty>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((item, i) => (
        <article
          key={item.id}
          style={{ '--i': Math.min(i, 10) } as CSSProperties}
          className={`adm-rise flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center md:justify-between ${cardClass}`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold">{item.number}</span>
              <span className="rounded-full bg-[#1b261b]/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#4a584a]">{item.type}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${STATUS_TONE[item.status] ?? 'bg-stone-100'}`}>{item.status}</span>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-[#1b261b]">“{item.reason}”</p>
            <p className="mt-1 text-[11px] text-[#4a584a]">Requested {formatShortDate(item.requestedAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {updating === item.id && <Spinner className="h-4 w-4 text-[#4a7333]" />}
            {item.status === 'requested' && (
              <>
                <button onClick={() => void update(item, 'rejected')} disabled={updating === item.id} className="rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40">
                  Reject
                </button>
                <button onClick={() => void update(item, 'approved')} disabled={updating === item.id} className={primaryButton}>
                  Approve
                </button>
              </>
            )}
            {item.status === 'approved' && item.type === 'return' && (
              <button onClick={() => void update(item, 'received')} disabled={updating === item.id} className={primaryButton}>
                Mark received
              </button>
            )}
            {item.status === 'approved' && item.type === 'cancellation' && <span className="max-w-[200px] text-[11px] text-[#4a584a]">Refund it from the order's Details.</span>}
          </div>
        </article>
      ))}
    </div>
  )
}
