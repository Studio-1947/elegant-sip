import { useState, type ReactNode } from 'react'
import type { Product } from '@elegantsip/shared'
import { api, type AdminProductEdit } from '../../lib/api'
import { errorText, inputClass, labelClass, primaryButton, type Notice } from './adminUi'
import { Spinner } from './ui/controls'

type Brewing = NonNullable<Product['brewingGuide']>
type Origin = NonNullable<Product['origin']>
type Flavor = NonNullable<Product['flavorProfile']>

const EMPTY_BREWING: Brewing = { temperature: '', time: '', steeps: '', leafAmount: '', notes: '' }
const EMPTY_ORIGIN: Origin = { origin: '', estate: '', elevation: '', harvest: '', cultivar: '' }
const EMPTY_FLAVOR: Flavor = { strength: 3, astringency: 3, sweetness: 3, floral: 3, caffeine: 3 }

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={labelClass}>
      {label}
      {children}
      {hint && <span className="mt-1 block normal-case tracking-normal text-[11px] text-[#4a584a]/80">{hint}</span>}
    </label>
  )
}

/** Optional block (brewing, origin, flavour): a checkbox decides whether the product shows it at all. */
function Optional({ title, on, setOn, children }: { title: string; on: boolean; setOn: (v: boolean) => void; children: ReactNode }) {
  return (
    <fieldset className={`rounded-2xl border p-4 transition duration-300 ${on ? 'border-[#8bb56e]/40 bg-white shadow-sm' : 'border-[#1b261b]/[0.08] bg-[#1b261b]/[0.02]'}`}>
      <legend className="px-1">
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 accent-[#4a7333]" />
          {title}
        </label>
      </legend>
      {on ? <div className="adm-rise">{children}</div> : <p className="text-xs text-[#4a584a]">Not shown on the product page. Tick to add it.</p>}
    </fieldset>
  )
}

/** Text, category, status and the optional info cards. Saved together with one button. */
export default function ProductDetailsForm({ product, onSaved, notify }: { product: Product; onSaved: () => void; notify: (n: Notice) => void }) {
  const [name, setName] = useState(product.name)
  const [category, setCategory] = useState(product.category)
  const [status, setStatus] = useState(product.status)
  const [description, setDescription] = useState(product.description)
  const [longDescription, setLongDescription] = useState(product.longDescription ?? '')
  const [notes, setNotes] = useState(product.tastingNotes.join(', '))
  const [bodyLevel, setBodyLevel] = useState(product.bodyLevel === null ? '' : String(product.bodyLevel))
  const [harvestLabel, setHarvestLabel] = useState(product.harvestLabel ?? '')
  const [brewingOn, setBrewingOn] = useState(product.brewingGuide !== null)
  const [brewing, setBrewing] = useState<Brewing>(product.brewingGuide ?? EMPTY_BREWING)
  const [originOn, setOriginOn] = useState(product.origin !== null)
  const [origin, setOrigin] = useState<Origin>(product.origin ?? EMPTY_ORIGIN)
  const [flavorOn, setFlavorOn] = useState(product.flavorProfile !== null)
  const [flavor, setFlavor] = useState<Flavor>(product.flavorProfile ?? EMPTY_FLAVOR)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const tastingNotes = notes.split(',').map((n) => n.trim()).filter(Boolean)
    const problems = [
      name.trim().length < 2 && 'Name needs at least 2 characters.',
      category.trim().length < 2 && 'Category needs at least 2 characters.',
      description.trim().length < 10 && 'Short description needs at least 10 characters.',
      description.trim().length > 600 && 'Short description must be 600 characters or fewer.',
      longDescription.trim().length > 4000 && 'Full description must be 4,000 characters or fewer.',
      tastingNotes.length > 8 && 'Up to 8 tasting notes.',
      tastingNotes.some((n) => n.length > 40) && 'Each tasting note must be 40 characters or fewer.',
      originOn && (origin.origin.trim().length < 2 || origin.estate.trim().length < 2) && 'Origin needs at least a region and an estate.',
    ].filter(Boolean)
    if (problems.length > 0) return notify({ tone: 'error', text: `${product.name}: ${problems[0]}` })

    const payload: AdminProductEdit = {
      name: name.trim(),
      category: category.trim(),
      status,
      description: description.trim(),
      longDescription: longDescription.trim() || null,
      tastingNotes,
      bodyLevel: bodyLevel ? Number(bodyLevel) : null,
      harvestLabel: harvestLabel.trim() || null,
      brewingGuide: brewingOn ? brewing : null,
      origin: originOn ? origin : null,
      flavorProfile: flavorOn ? flavor : null,
    }
    setBusy(true)
    try {
      await api.admin.updateProduct(product.slug, payload)
      notify({ tone: 'ok', text: `${name.trim()}: details saved. The site shows them on the next page load.` })
      onSaved()
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, 'The details could not be saved.') })
    } finally {
      setBusy(false)
    }
  }

  const text = (value: string, set: (v: string) => void, max?: number) => (
    <input value={value} onChange={(e) => set(e.target.value)} maxLength={max} className={inputClass} />
  )

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      className="space-y-4"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">{text(name, setName, 120)}</Field>
        <Field label="Category" hint="Also the shop filter, e.g. Black Tea.">{text(category, setCategory, 60)}</Field>
        <Field label="Status" hint="Coming soon can't be bought, whatever its price.">
          <select value={status} onChange={(e) => setStatus(e.target.value as Product['status'])} className={inputClass}>
            <option value="active">On sale</option>
            <option value="coming-soon">Coming soon</option>
          </select>
        </Field>
        <Field label="Tasting notes" hint="Comma-separated, up to 8.">{text(notes, setNotes)}</Field>
        <Field label="Body (1 light – 5 full)">
          <select value={bodyLevel} onChange={(e) => setBodyLevel(e.target.value)} className={inputClass}>
            <option value="">Not set</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </Field>
        <Field label="Harvest label" hint="Optional, e.g. Spring 2026.">{text(harvestLabel, setHarvestLabel, 60)}</Field>
      </div>
      <Field label={`Short description (${description.trim().length}/600)`} hint="On cards and at the top of the product page.">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} />
      </Field>
      <Field label={`Full description (${longDescription.trim().length}/4000)`} hint="The “About this tea” section. Leave a blank line between paragraphs.">
        <textarea value={longDescription} onChange={(e) => setLongDescription(e.target.value)} rows={8} className={inputClass} />
      </Field>

      <Optional title="Brewing guide" on={brewingOn} setOn={setBrewingOn}>
        <div className="grid gap-3 sm:grid-cols-4">
          {(['temperature', 'time', 'steeps', 'leafAmount'] as const).map((k) => (
            <Field key={k} label={{ temperature: 'Temperature', time: 'Steep time', steeps: 'Steeps', leafAmount: 'Leaf' }[k]}>
              <input value={brewing[k]} onChange={(e) => setBrewing({ ...brewing, [k]: e.target.value })} maxLength={k === 'steeps' ? 20 : 40} className={inputClass} />
            </Field>
          ))}
        </div>
        <div className="mt-3">
          <Field label="Brewing tip">
            <input value={brewing.notes} onChange={(e) => setBrewing({ ...brewing, notes: e.target.value })} maxLength={400} className={inputClass} />
          </Field>
        </div>
      </Optional>

      <Optional title="Tea origin" on={originOn} setOn={setOriginOn}>
        <div className="grid gap-3 sm:grid-cols-5">
          {(['origin', 'estate', 'elevation', 'harvest', 'cultivar'] as const).map((k) => (
            <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
              <input value={origin[k]} onChange={(e) => setOrigin({ ...origin, [k]: e.target.value })} maxLength={k === 'origin' || k === 'cultivar' ? 120 : k === 'estate' ? 80 : 60} className={inputClass} />
            </Field>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#4a584a]">Only fill this in with confirmed facts. It appears as a card on the product page.</p>
      </Optional>

      <Optional title="Flavour profile" on={flavorOn} setOn={setFlavorOn}>
        <div className="grid gap-3 sm:grid-cols-5">
          {(['strength', 'astringency', 'sweetness', 'floral', 'caffeine'] as const).map((k) => (
            <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)}: ${flavor[k]}/5`}>
              <input type="range" min={1} max={5} step={1} value={flavor[k]} onChange={(e) => setFlavor({ ...flavor, [k]: Number(e.target.value) })} className="mt-2 w-full accent-[#4a7333]" />
            </Field>
          ))}
        </div>
      </Optional>

      {/* Stays in view at the bottom of the editor while scrolling a long form. */}
      <div className="sticky -bottom-5 -mx-6 flex items-center justify-between gap-3 border-t border-[#1b261b]/[0.07] bg-[#fbfcf9]/95 px-6 py-3 backdrop-blur sm:-mx-7 sm:px-7">
        <span className="text-[11px] text-[#4a584a]">Text, category, status and the info cards save together.</span>
        <button type="submit" disabled={busy} className={primaryButton}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : null}
          {busy ? 'Saving…' : 'Save details'}
        </button>
      </div>
    </form>
  )
}
