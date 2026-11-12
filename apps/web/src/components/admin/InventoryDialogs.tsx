import { useCallback, useEffect, useState } from 'react'
import { api, type StockReason } from '../../lib/api'
import { adminApi, type InventoryRow, type LedgerEntry } from '../../lib/adminApi'
import { formatDateTime } from '../../lib/dates'
import { errorText, inputClass, labelClass, primaryButton, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Empty, Spinner, Tabs } from './ui/controls'

/* Inventory dialogs: adjusting one pack's stock, its packed weight, and the stock history. */

export const REASON_LABEL: Record<LedgerEntry['reason'], string> = {
  seed: 'Opening stock',
  order_reserved: 'Order placed',
  order_released: 'Order cancelled/expired',
  order_fulfilled: 'Fulfilled',
  restock: 'Restock',
  damaged: 'Damaged',
  sample: 'Sample',
  count_correction: 'Stock count',
  manual_adjustment: 'Adjustment',
}

type Mode = 'count' | 'change'
const CHANGE_REASONS: { value: Exclude<StockReason, 'count_correction'>; label: string; hint: string }[] = [
  { value: 'restock', label: 'Restock (adds)', hint: 'New packs arrived.' },
  { value: 'damaged', label: 'Damaged (removes)', hint: 'Torn, stale or spoilt packs written off.' },
  { value: 'sample', label: 'Sample / gift (removes)', hint: 'Given away for tasting or PR.' },
  { value: 'manual_adjustment', label: 'Other adjustment', hint: 'Anything else; say why in the note.' },
]

/** Count (set to) or add/remove with a reason. Calls onDone with the stock the API returned. */
export function AdjustStock({ row, onDone, onCancel }: { row: InventoryRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useFeedback()
  const [mode, setMode] = useState<Mode>('count')
  const [reason, setReason] = useState<Exclude<StockReason, 'count_correction'>>('restock')
  const [quantity, setQuantity] = useState('')
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Restock only adds; damaged and sample only remove.
  const sign = reason === 'restock' ? 'add' : reason === 'damaged' || reason === 'sample' ? 'remove' : direction

  const submit = async () => {
    const text = quantity.trim()
    if (!/^\d+$/.test(text)) return setError('Enter a whole number.')
    const n = Number(text)
    if (mode === 'change' && n === 0) return setError('Enter how many packs, more than 0.')
    if (mode === 'change' && sign === 'remove' && n > row.stock) return setError(`Only ${row.stock} in stock to remove.`)
    setBusy(true)
    setError('')
    try {
      const result = await api.admin.adjustStock({
        productSlug: row.productSlug,
        variantSize: row.size,
        ...(mode === 'count' ? { setTo: n, reason: 'count_correction' as const } : { delta: sign === 'add' ? n : -n, reason }),
        ...(note.trim() ? { note: note.trim() } : {}),
      })
      toast({
        tone: 'ok',
        title: `${row.productName} · ${row.size}`,
        text: result.delta === 0 ? `Already ${result.stock} in stock; nothing changed.` : `Stock is now ${result.stock} (${result.delta > 0 ? '+' : ''}${result.delta}).`,
      })
      onDone()
    } catch (cause) {
      setError(errorText(cause, 'Stock could not be updated.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="space-y-4">
      <p className="text-sm text-[#4a584a]">
        Now <b className="text-[#1b261b]">{row.stock}</b> in stock{row.held > 0 ? `, plus ${row.held} held by unpaid checkouts` : ''}.
      </p>
      <Tabs<Mode> value={mode} onChange={(m) => { setMode(m); setError('') }} items={[{ value: 'count', label: 'Count (set to)' }, { value: 'change', label: 'Add / remove' }]} />
      {mode === 'change' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Reason
            <select value={reason} onChange={(e) => setReason(e.target.value as typeof reason)} className={inputClass}>
              {CHANGE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <span className="mt-1 block normal-case tracking-normal text-[11px] text-[#4a584a]/80">{CHANGE_REASONS.find((r) => r.value === reason)?.hint}</span>
          </label>
          {reason === 'manual_adjustment' && (
            <label className={labelClass}>
              Direction
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'add' | 'remove')} className={inputClass}>
                <option value="add">Add packs</option>
                <option value="remove">Remove packs</option>
              </select>
            </label>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          {mode === 'count' ? 'Packs on the shelf' : sign === 'add' ? 'Packs to add' : 'Packs to remove'}
          <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="numeric" autoFocus required className={inputClass} />
        </label>
        <label className={labelClass}>
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder={mode === 'count' ? 'e.g. Monthly count' : 'e.g. New lot from estate'} className={inputClass} />
        </label>
      </div>
      {mode === 'count' && <p className="text-[11px] text-[#4a584a]">The difference from the current stock is recorded as a stock count. Orders placed meanwhile are taken into account.</p>}
      {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
        <button disabled={busy} className={primaryButton}>{busy ? <Spinner className="h-3.5 w-3.5" /> : null} Save stock</button>
      </div>
    </form>
  )
}

/** Packed weight of one pack, used for courier bookings. Empty resets to the size label. */
export function WeightEditor({ row, onDone, onCancel }: { row: InventoryRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useFeedback()
  const [grams, setGrams] = useState(row.weightIsSet ? String(row.weightGrams) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const text = grams.trim()
    if (text && (!/^\d+$/.test(text) || Number(text) < 1 || Number(text) > 50_000)) return setError('Grams between 1 and 50,000, or empty.')
    setBusy(true)
    setError('')
    try {
      const result = await api.admin.updateVariantPrice(row.productSlug, row.size, { weightGrams: text ? Number(text) : null })
      toast({ tone: 'ok', text: `${row.productName} · ${row.size}: ${result.weightGrams === null ? 'weight read from the size label again' : `${result.weightGrams} g per pack`}.` })
      onDone()
    } catch (cause) {
      setError(errorText(cause, 'The weight could not be saved.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="flex flex-wrap items-end gap-2">
      <label className={labelClass}>
        Grams per pack
        <input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="numeric" autoFocus placeholder={`${row.weightGrams} (from label)`} className={`${inputClass} w-36`} />
      </label>
      <button disabled={busy} className={primaryButton}>{busy ? <Spinner className="h-3.5 w-3.5" /> : 'Save'}</button>
      <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
      {error && <p role="alert" className="basis-full text-xs text-rose-700">{error}</p>}
    </form>
  )
}

/** Every stock movement, newest first; one pack, or every tea when no row is given. */
export function StockHistory({ row }: { row: { productSlug: string; size: string } | null }) {
  const { toast } = useFeedback()
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    (offset: number) =>
      adminApi
        .ledger({ ...(row ? { productSlug: row.productSlug, size: row.size } : {}), limit: 50, offset })
        .then((page) => {
          setEntries((all) => (offset === 0 ? page.entries : [...all, ...page.entries]))
          setHasMore(page.hasMore)
        })
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Stock history could not be loaded.') }))
        .finally(() => setLoading(false)),
    [row, toast],
  )

  useEffect(() => {
    void load(0)
  }, [load])

  if (loading && entries.length === 0) return <div className="grid place-items-center py-10"><Spinner className="h-6 w-6" /></div>
  if (entries.length === 0) return <Empty title="No stock movements yet" />

  return (
    <div>
      <ul className="divide-y divide-[#1b261b]/[0.07] rounded-2xl bg-white ring-1 ring-[#1b261b]/[0.07]">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-semibold text-[#1b261b]">{REASON_LABEL[e.reason] ?? e.reason}</span>
              {!row && <span className="text-[#4a584a]"> · {e.productName} {e.size}</span>}
              {e.orderNumber && <span className="ml-1 font-mono text-xs text-[#4a7333]"> {e.orderNumber}</span>}
              {e.note && <span className="block text-xs text-[#4a584a]">{e.note}</span>}
            </span>
            <span className="flex items-center gap-3">
              <span className="text-[11px] text-[#4a584a]">{formatDateTime(e.at)}</span>
              <b className={`min-w-[3rem] rounded-lg px-2 py-0.5 text-right font-mono text-sm ${e.delta > 0 ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-700'}`}>
                {e.delta > 0 ? '+' : '−'}{Math.abs(e.delta)}
              </b>
            </span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="mt-3 text-center">
          <button disabled={loading} onClick={() => { setLoading(true); void load(entries.length) }} className={quietButton}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : null} Load more
          </button>
        </div>
      )}
    </div>
  )
}
