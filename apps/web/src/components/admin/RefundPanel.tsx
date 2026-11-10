import { useCallback, useEffect, useState } from 'react'
import { ApiClientError, api, type AdminRefund, type AdminRefundLedger, type AdminRefundResult } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { formatDateTime } from '../../lib/dates'
import { paiseToRupeeInput, parseRupees, type Parsed } from '../../lib/adminInput'

/**
 * Refund amount typed by staff, in whole rupees, checked against what is
 * left. `full` means the "full remaining" shortcut was used: the exact
 * remaining paise are refunded, even if that is not a whole rupee.
 */
export function parseRefundAmount(input: string, refundable: number, full: boolean): Parsed<number> {
  if (refundable <= 0) return { ok: false, error: 'Nothing is left to refund on this order.' }
  if (full) return { ok: true, value: refundable }
  const parsed = parseRupees(input, 'Refund amount')
  if (!parsed.ok) return parsed
  if (parsed.value < 100) return { ok: false, error: 'Refund at least ₹1.' }
  if (parsed.value > refundable) return { ok: false, error: `At most ${formatINR(refundable)} can be refunded on this order.` }
  return parsed
}

const STATUS_TEXT: Record<AdminRefund['status'], string> = {
  processed: 'Refunded',
  pending: 'Awaiting Razorpay',
  failed: 'Failed',
}

/** What the API's answer means, in words that claim nothing it did not say. */
function resultMessage(result: AdminRefundResult): string {
  const amount = formatINR(result.refund.amount)
  const parts: string[] = []
  if (result.replayed) parts.push(`This refund was already submitted (${amount}, ${STATUS_TEXT[result.refund.status].toLowerCase()}). Nothing new was refunded.`)
  else if (result.refund.status === 'processed') parts.push(`Refunded ${amount}.`)
  else parts.push(`Refund of ${amount} requested; Razorpay has not confirmed it yet.`)
  if (result.emailed === true) parts.push('The customer was emailed.')
  if (result.emailed === false) parts.push('The refund email was not sent — let the customer know yourself.')
  if (result.advice) parts.push(result.advice)
  return parts.join(' ')
}

/**
 * Refunds for one order, inside the staff order detail: what was paid and
 * refunded, every attempt, and a form to refund all or part of what is left.
 * The API does the gateway call; this panel only reports what came back.
 */
export default function RefundPanel({ orderNumber, onChanged }: { orderNumber: string; onChanged: () => void }) {
  const [ledger, setLedger] = useState<AdminRefundLedger | null>(null)
  const [amountInput, setAmountInput] = useState('')
  const [full, setFull] = useState(false)
  const [reason, setReason] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  // Set while the confirmation is showing: the exact paise and the key that makes a retry safe.
  const [pending, setPending] = useState<{ amount: number; key: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLedger(await api.adminRefunds.get(orderNumber))
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Refunds could not be loaded.')
    }
  }, [orderNumber])

  useEffect(() => {
    let cancelled = false
    api.adminRefunds
      .get(orderNumber)
      .then((result) => !cancelled && setLedger(result))
      .catch((cause) => !cancelled && setError(cause instanceof ApiClientError ? cause.message : 'Refunds could not be loaded.'))
    return () => {
      cancelled = true
    }
  }, [orderNumber])

  if (!ledger) return <p className="mt-6 text-xs text-[#4a584a]">{error ?? 'Loading refunds…'}</p>

  const review = () => {
    setMessage(null)
    setError(null)
    const parsed = parseRefundAmount(amountInput, ledger.refundable, full)
    if (!parsed.ok) return setFormError(parsed.error)
    if (reason.trim().length < 3) return setFormError('Give a reason for the refund.')
    setFormError(null)
    setPending({ amount: parsed.value, key: crypto.randomUUID() })
  }

  const confirm = async () => {
    if (!pending) return
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.adminRefunds.create(orderNumber, { amount: pending.amount, reason: reason.trim(), idempotencyKey: pending.key })
      setLedger(result.ledger)
      setMessage(resultMessage(result))
      setPending(null)
      setAmountInput('')
      setFull(false)
      setReason('')
      onChanged()
    } catch (cause) {
      const apiError = cause instanceof ApiClientError ? cause : null
      const detail = apiError?.message ?? 'The refund request failed.'
      /* No answer, or the server failed part-way: keep the key, so confirming
         again returns the original refund rather than making a second one. */
      const unanswered = !apiError || apiError.status === 0 || (apiError.status >= 500 && apiError.type !== 'refund_failed')
      if (unanswered) {
        setError(`${detail} Confirming again is safe: it will not refund twice.`)
      } else {
        setError(detail)
        setPending(null)
        void load()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const cancelOrder = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await api.admin.updateOrder(orderNumber, { status: 'cancelled' })
      setMessage('Order cancelled. Its stock has been returned.')
      await load()
      onChanged()
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The order could not be cancelled.')
    } finally {
      setSubmitting(false)
    }
  }

  const button = 'rounded-full px-3.5 py-2 text-[10px] font-mono font-bold uppercase tracking-wider disabled:opacity-50'

  return (
    <section className="mt-6 rounded-xl border border-[#1b261b]/10 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wider">Refunds</h3>

      {ledger.captured === 0 ? (
        <p className="mt-2 text-xs text-[#4a584a]">No captured payment on this order, so there is nothing to refund.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
          <div><dt className="text-[#4a584a]">Paid</dt><dd className="font-bold">{formatINR(ledger.captured)}</dd></div>
          <div><dt className="text-[#4a584a]">Refunded</dt><dd className="font-bold">{formatINR(ledger.refunded)}</dd></div>
          <div><dt className="text-[#4a584a]">Awaiting Razorpay</dt><dd className="font-bold">{formatINR(ledger.pending)}</dd></div>
          <div><dt className="text-[#4a584a]">Remaining</dt><dd className="font-bold">{formatINR(ledger.refundable)}</dd></div>
        </dl>
      )}

      {ledger.refunds.length > 0 && (
        <ul className="mt-4 divide-y divide-[#1b261b]/10 border-y border-[#1b261b]/10">
          {ledger.refunds.map((refund) => (
            <li key={refund.id} className="py-2.5 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <b>{formatINR(refund.amount)}</b>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${refund.status === 'failed' ? 'text-rose-700' : refund.status === 'pending' ? 'text-amber-700' : 'text-[#315b26]'}`}>
                  {STATUS_TEXT[refund.status]}
                </span>
              </div>
              <p className="mt-0.5 text-[#4a584a]">{refund.reason}{refund.requestedBy ? ` · ${refund.requestedBy}` : ''}</p>
              <p className="mt-0.5 text-[#4a584a]">
                Requested {formatDateTime(refund.createdAt)}{refund.processedAt ? ` · refunded ${formatDateTime(refund.processedAt)}` : ''}
              </p>
              {refund.failureReason && <p className="mt-0.5 text-rose-700">{refund.failureReason}</p>}
            </li>
          ))}
        </ul>
      )}

      {message && <p role="status" className="mt-3 rounded-lg bg-[#8bb56e]/15 px-3 py-2 text-xs text-[#315b26]">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{error}</p>}

      {ledger.cancelAdvised && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p>The whole payment is refunded but this order has not shipped. If you are not sending it, cancel it so its stock is returned.</p>
          <button onClick={() => void cancelOrder()} disabled={submitting} className={`${button} mt-2 border border-rose-200 bg-white text-rose-700 hover:bg-rose-50`}>
            Cancel order
          </button>
        </div>
      )}

      {ledger.refundable > 0 && !pending && (
        <div className="mt-4 space-y-3 rounded-lg bg-[#f9faf7] p-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
              Amount (₹)
              <input
                value={amountInput}
                onChange={(event) => {
                  setAmountInput(event.target.value)
                  setFull(false)
                }}
                inputMode="numeric"
                placeholder={paiseToRupeeInput(ledger.refundable)}
                className="mt-1.5 block w-32 rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm normal-case tracking-normal"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setAmountInput(paiseToRupeeInput(ledger.refundable))
                setFull(true)
              }}
              className={`${button} border border-[#1b261b]/20 hover:border-[#8bb56e]`}
            >
              Full remaining ({formatINR(ledger.refundable)})
            </button>
          </div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
            Reason (kept with the refund)
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="e.g. Cancelled before dispatch"
              className="mt-1.5 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm normal-case tracking-normal"
            />
          </label>
          {formError && <p role="alert" className="text-xs text-rose-700">{formError}</p>}
          <button onClick={review} className={`${button} bg-[#1b261b] text-white hover:bg-[#4a7333]`}>Review refund</button>
        </div>
      )}

      {pending && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          <p>
            Refund <b>{formatINR(pending.amount)}</b> to the customer’s original payment method through Razorpay? This cannot be undone.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => void confirm()} disabled={submitting} className={`${button} bg-rose-700 text-white hover:bg-rose-800`}>
              {submitting ? 'Refunding…' : `Refund ${formatINR(pending.amount)}`}
            </button>
            <button onClick={() => setPending(null)} disabled={submitting} className={`${button} border border-[#1b261b]/20`}>Back</button>
          </div>
        </div>
      )}
    </section>
  )
}
