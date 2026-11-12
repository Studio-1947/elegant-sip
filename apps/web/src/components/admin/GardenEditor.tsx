import { useEffect, useState } from 'react'
import type { Product } from '@elegantsip/shared'
import { ApiClientError, api, type AdminGarden, type AdminGardenInput } from '../../lib/api'
import { forgetLiveGardens } from '../../lib/useGardens'

/* Mirrors the API's limits so most mistakes are caught before a round trip. */
const IMAGE_PATH = /^\/(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9/_.-]*\.webp$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_PARAGRAPHS = 12
const MAX_PARAGRAPH = 2000

interface Draft {
  slug: string
  name: string
  region: string
  elevation: string
  imageSrc: string
  /** Paragraphs separated by a blank line. */
  storyText: string
  productSlugs: string[]
}

const EMPTY: Draft = { slug: '', name: '', region: '', elevation: '', imageSrc: '', storyText: '', productSlugs: [] }

const toDraft = (g: AdminGarden): Draft => ({
  slug: g.slug,
  name: g.name,
  region: g.region,
  elevation: g.elevation,
  imageSrc: g.imageSrc,
  storyText: g.story.join('\n\n'),
  productSlugs: g.products.map((p) => p.slug),
})

/** Blank lines split paragraphs; line breaks inside one are just spaces on the page. */
export const parseStory = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)

function problems(d: Draft, isNew: boolean): string | null {
  if (isNew && !SLUG.test(d.slug)) return 'The short ID needs lowercase letters, numbers and dashes, e.g. "gopaldhara".'
  if (d.name.trim().length < 2 || d.name.trim().length > 80) return 'The name must be 2–80 characters.'
  if (d.region.trim().length < 2 || d.region.trim().length > 120) return 'The region must be 2–120 characters.'
  if (d.elevation.trim().length > 60) return 'The elevation must be 60 characters or fewer.'
  if (!IMAGE_PATH.test(d.imageSrc.trim())) return 'The image must be a .webp path already on the site, e.g. /gopal-1024.webp.'
  const story = parseStory(d.storyText)
  if (story.length > MAX_PARAGRAPHS) return `The story can have at most ${MAX_PARAGRAPHS} paragraphs.`
  if (story.some((p) => p.length > MAX_PARAGRAPH)) return `Each paragraph must be ${MAX_PARAGRAPH} characters or fewer.`
  return null
}

const input = 'mt-1 w-full rounded-lg border border-[#1b261b]/15 bg-white px-3 py-2 text-sm text-[#1b261b]'
const label = 'block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]'

/**
 * The garden editor: the copy on the Gardens page and which teas each garden
 * is linked to (the "From <garden>" line on product pages). The boot seed
 * never overwrites what is saved here.
 */
export default function GardenEditor() {
  const [gardens, setGardens] = useState<AdminGarden[] | null>(null)
  const [catalogue, setCatalogue] = useState<Product[]>([])
  /** The garden being edited, or 'new'. */
  const [selected, setSelected] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [slugTouched, setSlugTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    api.gardens
      .adminList()
      .then((r) => {
        if (!cancelled) setGardens(r.gardens)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'Gardens could not be loaded.')
      })
    // The checklist only; a failure here still leaves the garden copy editable.
    api.admin
      .products()
      .then((r) => {
        if (!cancelled) setCatalogue(r.products)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const isNew = selected === 'new'
  const current = gardens?.find((g) => g.slug === selected)

  const open = (slug: string) => {
    const g = gardens?.find((item) => item.slug === slug)
    setSelected(slug)
    setDraft(g ? toDraft(g) : EMPTY)
    setSlugTouched(false)
    setConfirmDelete(false)
    setError('')
    setMessage('')
  }

  // Shop products, plus anything already linked that the shop no longer lists (retired).
  const listed = new Set(catalogue.map((p) => p.slug))
  const choices = [
    ...catalogue.map((p) => ({ slug: p.slug, name: p.name, note: '' })),
    ...(current?.products ?? [])
      .filter((p) => !listed.has(p.slug))
      .map((p) => ({ slug: p.slug, name: p.name, note: p.archived ? 'retired — not shown' : 'not in the shop list' })),
  ]

  const toggleProduct = (slug: string) =>
    setDraft((d) => ({
      ...d,
      productSlugs: d.productSlugs.includes(slug) ? d.productSlugs.filter((s) => s !== slug) : [...d.productSlugs, slug],
    }))

  const save = async () => {
    const problem = problems(draft, isNew)
    if (problem) {
      setError(problem)
      return
    }
    const payload: AdminGardenInput = {
      name: draft.name.trim(),
      region: draft.region.trim(),
      elevation: draft.elevation.trim(),
      imageSrc: draft.imageSrc.trim(),
      story: parseStory(draft.storyText),
      productSlugs: draft.productSlugs,
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const saved = isNew ? await api.gardens.create({ ...payload, slug: draft.slug }) : await api.gardens.update(selected!, payload)
      setGardens((list) => (isNew ? [...(list ?? []), saved] : (list ?? []).map((g) => (g.slug === saved.slug ? saved : g))))
      setSelected(saved.slug)
      setDraft(toDraft(saved))
      forgetLiveGardens()
      setMessage(isNew ? `${saved.name} added.` : `${saved.name} saved.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The garden could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!current) return
    setBusy(true)
    setError('')
    try {
      await api.gardens.remove(current.slug)
      setGardens((list) => (list ?? []).filter((g) => g.slug !== current.slug))
      forgetLiveGardens()
      setSelected(null)
      setMessage(`${current.name} deleted. Its teas are unchanged.`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The garden could not be deleted.')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-4">
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Storefront</span>
        <h2 className="mt-1 text-xl font-bold uppercase tracking-tight">Gardens</h2>
        <p className="mt-1 text-xs text-[#4a584a]">
          The Gardens page, and the “From …” line on the product pages of the teas you tick. A garden with no story and no
          teas is not shown.
        </p>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {message && <p role="status" className="mb-4 text-sm text-[#315b26]">{message}</p>}
      <div className="grid gap-4 rounded-2xl border border-[#1b261b]/10 bg-white p-5 md:grid-cols-[220px_1fr]">
        <nav aria-label="Gardens" className="flex flex-col gap-2">
          {gardens === null ? (
            <p className="text-sm text-[#4a584a]">{error ? 'Gardens unavailable.' : 'Loading gardens…'}</p>
          ) : (
            gardens.map((g) => (
              <button
                key={g.slug}
                type="button"
                onClick={() => open(g.slug)}
                aria-current={selected === g.slug ? 'true' : undefined}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${selected === g.slug ? 'border-[#4a7333] bg-[#8bb56e]/10' : 'border-[#1b261b]/10 hover:border-[#8bb56e]'}`}
              >
                <span className="block font-bold">{g.name}</span>
                <span className="block text-[10px] font-mono text-[#4a584a]">
                  {g.products.filter((p) => !p.archived).length} tea{g.products.filter((p) => !p.archived).length === 1 ? '' : 's'} linked
                </span>
              </button>
            ))
          )}
          {gardens !== null && (
            <button type="button" onClick={() => open('new')} className="rounded-lg border border-dashed border-[#1b261b]/25 px-3 py-2 text-left text-sm hover:border-[#8bb56e]">
              + Add a garden
            </button>
          )}
        </nav>

        {selected === null ? (
          <p className="text-sm text-[#4a584a]">Choose a garden to edit, or add one.</p>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void save()
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={label}>
                Name
                <input
                  className={input}
                  value={draft.name}
                  maxLength={80}
                  onChange={(e) => {
                    const name = e.target.value
                    setDraft((d) => ({ ...d, name, slug: isNew && !slugTouched ? slugify(name) : d.slug }))
                  }}
                />
              </label>
              {isNew ? (
                <label className={label}>
                  Short ID (lowercase, dashes)
                  <input
                    className={input}
                    value={draft.slug}
                    maxLength={80}
                    onChange={(e) => {
                      setSlugTouched(true)
                      setDraft((d) => ({ ...d, slug: e.target.value }))
                    }}
                  />
                </label>
              ) : (
                <p className={label}>
                  Short ID
                  <span className="mt-1 block font-mono text-sm normal-case text-[#1b261b]">{draft.slug}</span>
                </p>
              )}
              <label className={label}>
                Region
                <input className={input} value={draft.region} maxLength={120} onChange={(e) => setDraft((d) => ({ ...d, region: e.target.value }))} />
              </label>
              <label className={label}>
                Elevation
                <input className={input} value={draft.elevation} maxLength={60} placeholder="e.g. 3,500–7,000 ft" onChange={(e) => setDraft((d) => ({ ...d, elevation: e.target.value }))} />
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <label className={`${label} min-w-0 flex-1`}>
                Photo (a .webp already on the site)
                <input className={input} value={draft.imageSrc} maxLength={200} placeholder="/gopal-1024.webp" onChange={(e) => setDraft((d) => ({ ...d, imageSrc: e.target.value }))} />
              </label>
              {IMAGE_PATH.test(draft.imageSrc.trim()) && (
                <img src={draft.imageSrc.trim()} alt="" width={96} height={72} className="h-18 w-24 rounded-lg border border-[#1b261b]/10 object-cover" />
              )}
            </div>
            <label className={label}>
              Story — leave a blank line between paragraphs
              <textarea className={`${input} min-h-48 font-sans`} value={draft.storyText} onChange={(e) => setDraft((d) => ({ ...d, storyText: e.target.value }))} />
            </label>
            <fieldset>
              <legend className={label}>Teas from this garden</legend>
              {choices.length === 0 ? (
                <p className="mt-2 text-sm text-[#4a584a]">The product list could not be loaded.</p>
              ) : (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {choices.map((p) => (
                    <label key={p.slug} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={draft.productSlugs.includes(p.slug)} onChange={() => toggleProduct(p.slug)} />
                      <span>
                        {p.name}
                        {p.note && <span className="ml-1 text-[10px] font-mono text-amber-700">({p.note})</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={busy} className="rounded-full bg-[#1b261b] px-5 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white hover:bg-[#4a7333] disabled:opacity-50">
                {busy ? 'Saving…' : isNew ? 'Add garden' : 'Save garden'}
              </button>
              {current &&
                (confirmDelete ? (
                  <>
                    <button type="button" onClick={() => void remove()} disabled={busy} className="rounded-full bg-rose-700 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white disabled:opacity-50">
                      Yes, delete {current.name}
                    </button>
                    <button type="button" onClick={() => setConfirmDelete(false)} className="text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
                      Keep it
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-full border border-rose-200 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700">
                    Delete garden
                  </button>
                ))}
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
