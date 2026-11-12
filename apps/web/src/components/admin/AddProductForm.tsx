import { useRef, useState, type ReactNode } from 'react'
import { api } from '../../lib/api'
import { dangerButton, errorText, inputClass, labelClass, primaryButton, quietButton, toPaise } from './adminUi'
import { Spinner } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Add a tea: the essentials for a product card and page, plus its first
 * packs. Everything else (gallery, brewing card, origin, flavour, garden) is
 * edited afterwards in the product editor, which opens once this is saved.
 * ──────────────────────────────────────────────────────────────────────────── */

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const MAX_BYTES = 15 * 1024 * 1024
const MAX_PACKS = 5

type Pack = { size: string; price: string; stock: string; weight: string }
const EMPTY_PACK: Pack = { size: '', price: '', stock: '0', weight: '' }

/** "First Flush — Whole Leaf" → "first-flush-whole-leaf". */
export const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)

function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`${labelClass} ${wide ? 'sm:col-span-2' : ''}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block normal-case tracking-normal text-[11px] text-[#4a584a]/80">{hint}</span>}
    </label>
  )
}

export default function AddProductForm({ onCreated, onCancel }: { onCreated: (slug: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState<'active' | 'coming-soon'>('active')
  const [description, setDescription] = useState('')
  const [harvestLabel, setHarvestLabel] = useState('')
  const [notes, setNotes] = useState('')
  const [imageSrc, setImageSrc] = useState('')
  const [packs, setPacks] = useState<Pack[]>([{ ...EMPTY_PACK }])
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  const editPack = (index: number, change: Partial<Pack>) => setPacks((all) => all.map((p, i) => (i === index ? { ...p, ...change } : p)))

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (!ACCEPT.split(',').includes(file.type)) return setError('Only JPG, PNG, WebP or AVIF photos can be uploaded.')
    if (file.size > MAX_BYTES) return setError(`${file.name} is over 15 MB.`)
    setUploading(true)
    setError('')
    try {
      setImageSrc((await api.admin.uploadProductPhoto(file)).src)
    } catch (cause) {
      setError(errorText(cause, 'Upload failed.'))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  /** The request body, or the first thing wrong with the form. */
  const build = () => {
    const tastingNotes = notes.split(',').map((n) => n.trim()).filter(Boolean)
    if (name.trim().length < 2) return 'Give the tea a name (at least 2 characters).'
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'The web address may use only lowercase letters, numbers and single hyphens.'
    if (category.trim().length < 2) return 'Give it a category, e.g. Black Tea.'
    if (description.trim().length < 10 || description.trim().length > 600) return 'The short description needs 10 to 600 characters.'
    if (!imageSrc) return 'Upload a main photo.'
    if (tastingNotes.length > 8 || tastingNotes.some((n) => n.length > 40)) return 'Up to 8 tasting notes, each 40 characters or fewer.'
    const variants = []
    const sizes = new Set<string>()
    for (const [i, p] of packs.entries()) {
      const label = `Pack ${i + 1}`
      const price = toPaise(p.price) ?? 0
      if (!p.size.trim()) return `${label}: give it a size, e.g. 100 g.`
      if (sizes.has(p.size.trim().toLowerCase())) return `${label}: "${p.size.trim()}" is listed twice.`
      sizes.add(p.size.trim().toLowerCase())
      if (Number.isNaN(price)) return `${label}: the price must be rupees, e.g. 450.`
      if (status === 'active' && price <= 0) return `${label}: a tea on sale needs a price above ₹0 (or mark it Coming soon).`
      if (!/^\d+$/.test(p.stock.trim())) return `${label}: opening stock must be a whole number, 0 or more.`
      if (p.weight.trim() && (!/^\d+$/.test(p.weight.trim()) || Number(p.weight) < 1 || Number(p.weight) > 50_000)) return `${label}: weight must be grams, 1 to 50,000, or empty.`
      variants.push({
        size: p.size.trim(),
        price,
        stock: Number(p.stock.trim()),
        ...(p.weight.trim() ? { weightGrams: Number(p.weight.trim()) } : {}),
      })
    }
    return {
      slug,
      name: name.trim(),
      status,
      description: description.trim(),
      imageSrc,
      category: category.trim(),
      tastingNotes,
      ...(harvestLabel.trim() ? { harvestLabel: harvestLabel.trim() } : {}),
      variants,
    }
  }

  const submit = async () => {
    const body = build()
    if (typeof body === 'string') return setError(body)
    setBusy(true)
    setError('')
    try {
      const created = await api.admin.createProduct(body)
      onCreated(created.slug)
    } catch (cause) {
      setError(errorText(cause, 'The tea could not be added.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit() }} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              if (!slugTouched) setSlug(slugify(e.target.value))
            }}
            maxLength={120}
            autoFocus
            className={inputClass}
          />
        </Field>
        <Field label="Web address" hint={slug ? `elegantsip.in/product/${slug}` : 'Filled in from the name; cannot be changed later.'}>
          <input value={slug} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase()) }} maxLength={80} className={`${inputClass} font-mono`} />
        </Field>
        <Field label="Category" hint="Also the shop filter, e.g. Black Tea.">
          <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} className={inputClass} />
        </Field>
        <Field label="Status" hint="Coming soon is listed but can't be bought.">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
            <option value="active">On sale</option>
            <option value="coming-soon">Coming soon</option>
          </select>
        </Field>
        <Field label={`Short description (${description.trim().length}/600)`} hint="On cards and at the top of the product page." wide>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={600} className={inputClass} />
        </Field>
        <Field label="Tasting notes" hint="Comma-separated, up to 8.">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Muscatel, honey, stone fruit" className={inputClass} />
        </Field>
        <Field label="Harvest label" hint="Optional, e.g. Spring 2026.">
          <input value={harvestLabel} onChange={(e) => setHarvestLabel(e.target.value)} maxLength={60} className={inputClass} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-[#1b261b]/15 p-4">
        <div className="grid h-24 w-24 flex-shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f2f4ef]">
          {uploading ? <Spinner className="h-6 w-6" /> : imageSrc ? <img src={imageSrc} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">📷</span>}
        </div>
        <div className="text-sm text-[#4a584a]">
          <p className="font-semibold text-[#1b261b]">Main photo</p>
          <p className="text-xs">Shown on cards. JPG, PNG, WebP or AVIF up to 15 MB. Add more photos after saving.</p>
          <input ref={fileInput} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
          <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className={`${quietButton} mt-2`}>
            {imageSrc ? 'Replace photo' : 'Upload photo'}
          </button>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className={labelClass}>Packs</legend>
        {packs.map((p, i) => (
          <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-2xl border border-[#1b261b]/[0.08] bg-white p-3 sm:grid-cols-[1fr_1fr_6rem_6rem_auto]">
            <label className={labelClass}>Size<input value={p.size} onChange={(e) => editPack(i, { size: e.target.value })} placeholder="100 g" maxLength={60} className={inputClass} /></label>
            <label className={labelClass}>Selling price ₹<input value={p.price} onChange={(e) => editPack(i, { price: e.target.value })} inputMode="decimal" placeholder={status === 'coming-soon' ? '0' : '450'} className={inputClass} /></label>
            <label className={labelClass}>Stock<input value={p.stock} onChange={(e) => editPack(i, { stock: e.target.value })} inputMode="numeric" className={inputClass} /></label>
            <label className={labelClass}>Weight g<input value={p.weight} onChange={(e) => editPack(i, { weight: e.target.value })} inputMode="numeric" placeholder="auto" className={inputClass} /></label>
            <button type="button" disabled={packs.length === 1} onClick={() => setPacks((all) => all.filter((_, j) => j !== i))} className={dangerButton}>Remove</button>
          </div>
        ))}
        {packs.length < MAX_PACKS && (
          <button type="button" onClick={() => setPacks((all) => [...all, { ...EMPTY_PACK }])} className={quietButton}>+ Another pack</button>
        )}
        <p className="text-[11px] text-[#4a584a]">Prices include GST. Weight is the packed weight for the courier; empty reads it from the size (e.g. 100 g).</p>
      </fieldset>

      {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={quietButton}>Cancel</button>
        <button disabled={busy || uploading} className={primaryButton}>{busy ? <Spinner className="h-3.5 w-3.5" /> : null} Add tea</button>
      </div>
    </form>
  )
}
