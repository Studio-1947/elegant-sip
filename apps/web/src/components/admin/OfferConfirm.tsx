import { useEffect, useState } from 'react'
import { ApiClientError, api, type OfferAction, type OfferChange } from '../../lib/api'
import { formatINR } from '../../lib/currency'

const ACTION_TEXT: Record<OfferAction, { title: string; explain: string; confirm: string }> = {
  'end-offer': {
    title: 'End the offer',
    explain: 'The selling price goes back up to the regular price, and the struck-out price is removed.',
    confirm: 'End offer',
  },
  'clear-compare-at': {
    title: 'Remove the struck-out price',
    explain: 'The selling price stays as it is; only the struck-out "regular" price is removed.',
    confirm: 'Remove struck-out price',
  },
}

const priceText = ({ price, compareAtPrice }: OfferChange['before']) =>
  compareAtPrice === null ? formatINR(price) : `${formatINR(price)} (was ${formatINR(compareAtPrice)})`

/**
 * In-page confirmation for ending offers on one tea or all of them. It shows
 * the server's own preview of every pack size that will change, then reports
 * what the server says it actually changed.
 */
export default function OfferConfirm({ action, productSlug, onCancel, onDone }: {
  action: OfferAction
  /** Omit for every tea. */
  productSlug?: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const [changes, setChanges] = useState<OfferChange[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const text = ACTION_TEXT[action]

  useEffect(() => {
    let cancelled = false
    api.admin
      .previewOffers(action, productSlug)
      .then((response) => { if (!cancelled) setChanges(response.changes) })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'The preview could not be loaded.')
      })
    return () => { cancelled = true }
  }, [action, productSlug])

  const teaCount = new Set(changes?.map((c) => c.productSlug)).size

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const { changes: applied } = await api.admin.endOffers(action, productSlug)
      const teas = new Set(applied.map((c) => c.productSlug)).size
      onDone(applied.length === 0
        ? 'Nothing changed: no pack size had a struck-out price.'
        : `${text.confirm}: ${applied.length} pack size${applied.length === 1 ? '' : 's'} on ${teas} tea${teas === 1 ? '' : 's'} updated.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Nothing was changed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div role="group" aria-label={text.title} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-[#1b261b]">
      <p className="font-bold">{text.title}{productSlug ? '' : ' on every tea'}</p>
      <p className="mt-1 text-xs text-[#4a584a]">{text.explain}</p>
      {changes === null && !error && <p className="mt-3 text-xs text-[#4a584a]">Checking what will change…</p>}
      {changes !== null && changes.length === 0 && <p className="mt-3 text-xs">No pack size has a struck-out price, so there is nothing to change.</p>}
      {changes !== null && changes.length > 0 && (
        <>
          <p className="mt-3 text-xs font-bold">{changes.length} pack size{changes.length === 1 ? '' : 's'} on {teaCount} tea{teaCount === 1 ? '' : 's'} will change:</p>
          <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg bg-white px-3 py-2 text-xs">
            {changes.map((c) => (
              <li key={`${c.productSlug}/${c.size}`} className="flex flex-wrap gap-x-2">
                <span className="font-bold">{c.productName}{c.retired ? ' (retired)' : ''} · {c.size}</span>
                <span className="text-[#4a584a]">{priceText(c.before)} → {priceText(c.after)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {changes !== null && changes.length > 0 && (
          <button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-lg bg-[#1b261b] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Saving…' : text.confirm}</button>
        )}
        <button type="button" onClick={onCancel} className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">{changes?.length === 0 ? 'Close' : 'Cancel'}</button>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </div>
  )
}
