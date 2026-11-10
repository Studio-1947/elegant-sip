import { useState } from 'react'
import type { Product } from '@elegantsip/shared'
import { ApiClientError, api, type AdminProductEdit } from '../../lib/api'

type Brewing = NonNullable<Product['brewingGuide']>

const inputClass = 'mt-1 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-2.5 py-1.5 text-sm text-[#1b261b]'
const labelClass = 'text-[10px] font-mono uppercase tracking-wider text-[#4a584a]'

const BREWING_FIELDS: { key: keyof Brewing; label: string; max: number; placeholder: string }[] = [
  { key: 'temperature', label: 'Water temperature', max: 40, placeholder: '85°C / 185°F' },
  { key: 'time', label: 'Steep time', max: 40, placeholder: '3–4 minutes' },
  { key: 'steeps', label: 'Steeps', max: 20, placeholder: '2–3' },
  { key: 'leafAmount', label: 'Leaf amount', max: 40, placeholder: '1 tsp per 8 oz' },
]

const emptyBrewing: Brewing = { temperature: '', time: '', steeps: '', leafAmount: '', notes: '' }

/** "muscatel, honey ,  " → ["muscatel", "honey"] */
const parseTastingNotes = (input: string): string[] =>
  input.split(',').map((note) => note.trim()).filter(Boolean)

/**
 * The product's words: name, status, descriptions, tasting notes, harvest and
 * the brewing card. Only changed fields are sent; a blank optional field
 * clears it.
 */
export default function ProductDetailsForm({ product, onCancel, onSaved }: { product: Product; onCancel: () => void; onSaved: (name: string) => void }) {
  const [name, setName] = useState(product.name)
  const [status, setStatus] = useState(product.status)
  const [description, setDescription] = useState(product.description)
  const [longDescription, setLongDescription] = useState(product.longDescription ?? '')
  const [notes, setNotes] = useState(product.tastingNotes.join(', '))
  const [harvest, setHarvest] = useState(product.harvestLabel ?? '')
  const [brewing, setBrewing] = useState<Brewing>(product.brewingGuide ?? emptyBrewing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const validate = (): AdminProductEdit | string => {
    const changes: AdminProductEdit = {}
    if (name.trim() !== product.name) changes.name = name.trim()
    if (status !== product.status) changes.status = status
    if (description.trim() !== product.description) changes.description = description.trim()
    const long = longDescription.trim() || null
    if (long !== product.longDescription) changes.longDescription = long
    const tasting = parseTastingNotes(notes)
    if (tasting.join('\n') !== product.tastingNotes.join('\n')) changes.tastingNotes = tasting
    const harvestLabel = harvest.trim() || null
    if (harvestLabel !== product.harvestLabel) changes.harvestLabel = harvestLabel

    const card = Object.fromEntries(Object.entries(brewing).map(([k, v]) => [k, v.trim()])) as Brewing
    const filled = Object.values(card).some(Boolean)
    const nextCard = filled ? card : null
    if (JSON.stringify(nextCard) !== JSON.stringify(product.brewingGuide)) changes.brewingGuide = nextCard

    if (Object.keys(changes).length === 0) return 'Nothing has changed.'
    if (changes.name !== undefined && (changes.name.length < 2 || changes.name.length > 120)) return 'The name must be 2 to 120 characters.'
    if (changes.description !== undefined && (changes.description.length < 10 || changes.description.length > 600)) return 'The short description must be 10 to 600 characters.'
    if (tasting.length > 8) return 'Use at most 8 tasting notes.'
    if (tasting.some((note) => note.length > 40)) return 'Each tasting note must be 40 characters or fewer.'
    if (filled && BREWING_FIELDS.some(({ key }) => !card[key])) {
      return 'Fill in temperature, time, steeps and leaf amount, or clear the whole brewing card.'
    }
    return changes
  }

  const submit = async () => {
    const changes = validate()
    if (typeof changes === 'string') return setError(changes)
    setBusy(true)
    setError('')
    try {
      await api.admin.updateProduct(product.slug, changes)
      onSaved(changes.name ?? product.name)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The product could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="mt-4 grid gap-3 rounded-xl border border-[#1b261b]/10 p-4 sm:grid-cols-[2fr_1fr]">
      <label className={labelClass}>Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required className={inputClass} /></label>
      <label className={labelClass}>Status
        <select value={status} onChange={(event) => setStatus(event.target.value as Product['status'])} className={inputClass}>
          <option value="active">Active (on sale)</option>
          <option value="coming-soon">Coming soon (not for sale)</option>
        </select>
      </label>
      <label className={`${labelClass} sm:col-span-2`}>Short description<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={600} rows={3} required className={inputClass} /></label>
      <label className={`${labelClass} sm:col-span-2`}>Long description (product page, optional)<textarea value={longDescription} onChange={(event) => setLongDescription(event.target.value)} maxLength={4000} rows={6} className={inputClass} /></label>
      <label className={labelClass}>Tasting notes (comma separated)<input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="muscatel, honey, stone fruit" className={inputClass} /></label>
      <label className={labelClass}>Harvest label (optional)<input value={harvest} onChange={(event) => setHarvest(event.target.value)} maxLength={60} placeholder="First Flush 2026" className={inputClass} /></label>
      <fieldset className="grid gap-3 rounded-lg border border-[#1b261b]/10 p-3 sm:col-span-2 sm:grid-cols-4">
        <legend className={`${labelClass} px-1`}>Brewing card (leave every box blank for none)</legend>
        {BREWING_FIELDS.map(({ key, label, max, placeholder }) => (
          <label key={key} className={labelClass}>{label}<input value={brewing[key]} onChange={(event) => setBrewing((b) => ({ ...b, [key]: event.target.value }))} maxLength={max} placeholder={placeholder} className={inputClass} /></label>
        ))}
        <label className={`${labelClass} sm:col-span-4`}>Brewing notes (optional)<textarea value={brewing.notes} onChange={(event) => setBrewing((b) => ({ ...b, notes: event.target.value }))} maxLength={400} rows={2} className={inputClass} /></label>
      </fieldset>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <button disabled={busy} className="rounded-lg bg-[#4a7333] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save details'}</button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Cancel</button>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </form>
  )
}
