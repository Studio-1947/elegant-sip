import { useState } from 'react'
import { ApiClientError, api } from '../../lib/api'
import { parseRestockQuantity } from '../../lib/adminInput'

/**
 * "Restock" for one variant: a quantity, then POST /v1/admin/stock, which
 * records the movement in the stock ledger. Reports the stock the API returned,
 * never a figure worked out here.
 */
export default function RestockForm({
  productSlug,
  productName,
  size,
  onRestocked,
}: {
  productSlug: string
  productName: string
  size: string
  onRestocked: (message: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open) {
    return <button type="button" onClick={() => { setOpen(true); setQuantity(''); setNote(''); setError('') }} className="rounded-full border border-[#1b261b]/20 bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider hover:border-[#8bb56e]">Restock</button>
  }

  const submit = async () => {
    const parsed = parseRestockQuantity(quantity)
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await api.admin.adjustStock({ productSlug, variantSize: size, delta: parsed.value, ...(note.trim() ? { note: note.trim() } : {}) })
      setOpen(false)
      onRestocked(`Added ${parsed.value} to ${productName} (${size}). Stock is now ${result.stock}.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Stock could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="flex flex-wrap items-end gap-2">
      <label className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Packs to add
        <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="numeric" autoFocus required className="mt-1 block w-24 rounded-lg border border-[#1b261b]/15 bg-white px-2.5 py-1.5 text-sm text-[#1b261b]" />
      </label>
      <label className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Note (optional)
        <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="e.g. New lot from estate" className="mt-1 block w-44 rounded-lg border border-[#1b261b]/15 bg-white px-2.5 py-1.5 text-sm text-[#1b261b]" />
      </label>
      <button disabled={busy} className="rounded-lg bg-[#4a7333] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Saving…' : 'Add stock'}</button>
      <button type="button" onClick={() => setOpen(false)} className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Cancel</button>
      {error && <p role="alert" className="basis-full text-xs text-rose-700">{error}</p>}
    </form>
  )
}
