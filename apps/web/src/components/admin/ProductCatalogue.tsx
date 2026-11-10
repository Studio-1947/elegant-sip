import { useEffect, useState } from 'react'
import type { Product } from '@elegantsip/shared'
import { ApiClientError, api, type OfferAction } from '../../lib/api'
import { paiseToRupeeInput, parseRupees } from '../../lib/adminInput'
import { formatINR } from '../../lib/currency'
import { formatShortDate } from '../../lib/dates'
import { refreshCatalogue } from '../../lib/liveCatalogue'
import RestockForm from './RestockForm'
import OfferConfirm from './OfferConfirm'
import ProductDetailsForm from './ProductDetailsForm'

type Variant = Product['variants'][number]
type Filter = 'on-sale' | 'coming-soon' | 'retired' | 'all'

// The shop reads live prices, stock and status when a page loads; checkout re-prices on the server.
const SAVED_NOTE = 'Checkout uses it now; shop pages show it the next time they load.'

const inputClass = 'mt-1 block w-full rounded-lg border border-[#1b261b]/15 bg-white px-2.5 py-1.5 text-sm text-[#1b261b]'
const labelClass = 'text-[10px] font-mono uppercase tracking-wider text-[#4a584a]'
const smallButton = 'rounded-full border border-[#1b261b]/20 bg-white px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider hover:border-[#8bb56e]'

const FILTERS: { value: Filter; label: string; matches: (p: Product) => boolean }[] = [
  { value: 'on-sale', label: 'On sale', matches: (p) => !p.archivedAt && p.status === 'active' },
  { value: 'coming-soon', label: 'Coming soon', matches: (p) => !p.archivedAt && p.status === 'coming-soon' },
  { value: 'retired', label: 'Retired', matches: (p) => Boolean(p.archivedAt) },
  { value: 'all', label: 'All', matches: () => true },
]

/** One open in-page panel at a time: an edit form or a confirmation. */
type Panel =
  | { kind: 'details' | 'retire'; slug: string }
  | { kind: 'price'; variantId: string }
  | { kind: 'offer'; action: OfferAction; slug?: string }

const samePanel = (a: Panel | null, b: Panel) => JSON.stringify(a) === JSON.stringify(b)

/**
 * Products and their variants, read live from the admin API (retired teas
 * included), with in-page forms for details, prices, offers, stock and
 * retiring. Stock is changed only through the ledgered stock endpoint.
 *
 * `version` changing reloads the list; `onStockChanged` lets the page refresh
 * its low-stock list.
 */
export default function ProductCatalogue({ version, onStockChanged }: { version: number; onStockChanged: () => void }) {
  const [products, setProducts] = useState<Product[] | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [filter, setFilter] = useState<Filter>('on-sale')
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.admin
      .products()
      .then((response) => {
        if (cancelled) return
        setProducts(response.products)
        setError('')
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof ApiClientError ? cause.message : 'The product list could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [version, reloads])

  const open = (next: Panel) => {
    setPanel(next)
    setMessage('')
  }

  const saved = (text: string) => {
    setPanel(null)
    setMessage(text)
    setReloads((n) => n + 1)
    // Keep this tab's shop pages current too.
    void refreshCatalogue(true)
  }

  const offersOn = (product: Product) => product.variants.some((v) => v.compareAtPrice !== null)
  const visible = products?.filter(FILTERS.find((f) => f.value === filter)!.matches) ?? null

  return (
    <section className="mt-10">
      <div className="mb-4"><span className="text-xs font-mono uppercase tracking-[0.25em] text-[#4a7333]">Catalogue</span><h2 className="mt-1 text-xl font-bold uppercase tracking-tight">Products & stock</h2><p className="mt-1 max-w-2xl text-xs text-[#4a584a]">Prices are in whole rupees, GST included. {SAVED_NOTE}</p></div>
      {message && <div role="status" className="mb-4 rounded-xl border border-[#8bb56e]/50 bg-[#f0f7ea] px-4 py-3 text-sm text-[#315b26]">{message}</div>}
      {error && <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" role="radio" aria-checked={filter === f.value} onClick={() => setFilter(f.value)} className={`rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${filter === f.value ? 'border-[#1b261b] bg-[#1b261b] text-white' : 'border-[#1b261b]/20 bg-white'}`}>
              {f.label}{products ? ` (${products.filter(f.matches).length})` : ''}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => open({ kind: 'offer', action: 'end-offer' })} className={smallButton}>End every offer…</button>
          <button type="button" onClick={() => open({ kind: 'offer', action: 'clear-compare-at' })} className={smallButton}>Remove all struck-out prices…</button>
        </div>
      </div>
      {panel?.kind === 'offer' && !panel.slug && <div className="mb-3"><OfferConfirm key={panel.action} action={panel.action} onCancel={() => setPanel(null)} onDone={(text) => saved(`${text} ${SAVED_NOTE}`)} /></div>}
      <div className="overflow-hidden rounded-2xl border border-[#1b261b]/10 bg-white">
        {visible === null ? <p className="p-6 text-sm text-[#4a584a]">{error ? 'Products unavailable.' : 'Loading products…'}</p> : visible.length === 0 ? <p className="p-6 text-sm text-[#4a584a]">No products here.</p> : (
          <div className="divide-y divide-[#1b261b]/10">
            {visible.map((product) => (
              <article key={product.slug} className={`p-5 ${product.archivedAt ? 'bg-stone-50' : ''}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="text-sm font-bold">{product.name}</h3>
                    <span className="font-mono text-[10px] text-[#4a584a]">{product.slug}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${product.status === 'active' ? 'border-green-200 bg-green-50 text-green-800' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>{product.status}</span>
                    {product.archivedAt && <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-rose-800">Retired {formatShortDate(product.archivedAt)}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => open({ kind: 'details', slug: product.slug })} className={smallButton}>Edit details</button>
                    {offersOn(product) && <>
                      <button type="button" onClick={() => open({ kind: 'offer', action: 'end-offer', slug: product.slug })} className={smallButton}>End offer…</button>
                      <button type="button" onClick={() => open({ kind: 'offer', action: 'clear-compare-at', slug: product.slug })} className={smallButton}>Remove struck-out price…</button>
                    </>}
                    <button type="button" onClick={() => open({ kind: 'retire', slug: product.slug })} className={`${smallButton} ${product.archivedAt ? '' : 'text-rose-700'}`}>{product.archivedAt ? 'Bring back…' : 'Retire…'}</button>
                  </div>
                </div>
                {samePanel(panel, { kind: 'details', slug: product.slug }) && <ProductDetailsForm product={product} onCancel={() => setPanel(null)} onSaved={(name) => saved(`${name} saved. ${SAVED_NOTE}`)} />}
                {samePanel(panel, { kind: 'retire', slug: product.slug }) && <RetireConfirm product={product} onCancel={() => setPanel(null)} onSaved={saved} />}
                {panel?.kind === 'offer' && panel.slug === product.slug && <OfferConfirm key={panel.action} action={panel.action} productSlug={product.slug} onCancel={() => setPanel(null)} onDone={(text) => saved(`${product.name}: ${text} ${SAVED_NOTE}`)} />}
                <ul className="mt-3 divide-y divide-[#1b261b]/5 rounded-xl bg-[#f9faf7] px-4">
                  {product.variants.map((variant) => (
                    <li key={variant.id} className="py-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="min-w-22.5 font-bold">{variant.size}</span>
                        <span>{formatINR(variant.price)}{variant.compareAtPrice !== null && <s className="ml-2 text-xs text-[#4a584a]">{formatINR(variant.compareAtPrice)}</s>}</span>
                        <span className={`font-mono text-xs ${variant.stock <= 5 ? 'text-amber-800' : 'text-[#4a584a]'}`}>{variant.stock} in stock</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {!samePanel(panel, { kind: 'price', variantId: variant.id }) && <button type="button" onClick={() => open({ kind: 'price', variantId: variant.id })} className={smallButton}>Edit price</button>}
                          <RestockForm productSlug={product.slug} productName={product.name} size={variant.size} onRestocked={(text) => { saved(text); onStockChanged() }} />
                        </div>
                      </div>
                      {samePanel(panel, { kind: 'price', variantId: variant.id }) && <VariantPriceForm slug={product.slug} variant={variant} onCancel={() => setPanel(null)} onSaved={saved} />}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** In-page confirmation for retiring a tea or bringing it back. */
function RetireConfirm({ product, onCancel, onSaved }: { product: Product; onCancel: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const retiring = !product.archivedAt

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      await api.admin.updateProduct(product.slug, { archived: retiring })
      onSaved(retiring
        ? `${product.name} is retired: it is off the shop and cannot be ordered. ${SAVED_NOTE}`
        : `${product.name} is back on the shop as ${product.status === 'active' ? 'on sale' : 'coming soon'}. ${SAVED_NOTE}`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Nothing was changed. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div role="group" aria-label={retiring ? 'Retire this tea' : 'Bring this tea back'} className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
      <p className="font-bold">{retiring ? `Retire ${product.name}?` : `Bring back ${product.name}?`}</p>
      <p className="mt-1 text-xs text-[#4a584a]">
        {retiring
          ? 'It leaves the shop, search and wishlists, and cannot be ordered. Orders already placed are not affected, and you can bring it back at any time.'
          : `It returns to the shop as ${product.status === 'active' ? 'on sale' : 'coming soon'}, with the prices and stock shown below.`}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={() => void confirm()} className="rounded-lg bg-[#1b261b] px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Saving…' : retiring ? 'Retire' : 'Bring back'}</button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Cancel</button>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
      </div>
    </div>
  )
}

function VariantPriceForm({ slug, variant, onCancel, onSaved }: { slug: string; variant: Variant; onCancel: () => void; onSaved: (message: string) => void }) {
  const [price, setPrice] = useState(paiseToRupeeInput(variant.price))
  const [compareAt, setCompareAt] = useState(variant.compareAtPrice === null ? '' : paiseToRupeeInput(variant.compareAtPrice))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const parsedPrice = parseRupees(price, 'Price')
    if (!parsedPrice.ok) return setError(parsedPrice.error)
    // Blank means no offer: the struck-out price is removed.
    const parsedCompare = compareAt.trim() ? parseRupees(compareAt, 'Regular price') : ({ ok: true, value: null } as const)
    if (!parsedCompare.ok) return setError(parsedCompare.error)
    if (parsedCompare.value !== null && parsedCompare.value <= parsedPrice.value) {
      return setError('The regular (struck-out) price must be higher than the selling price. Leave it blank for no offer.')
    }
    setBusy(true)
    setError('')
    try {
      const result = await api.admin.updateVariantPrice(slug, variant.size, { price: parsedPrice.value, compareAtPrice: parsedCompare.value })
      const offer = result.compareAtPrice !== null ? `, regular price ${formatINR(result.compareAtPrice)}` : ''
      onSaved(`${variant.size} is now ${formatINR(result.price)}${offer}. ${SAVED_NOTE}`)
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The price could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-[#1b261b]/10 bg-white p-3">
      <label className={labelClass}>Selling price (₹)<input value={price} onChange={(event) => setPrice(event.target.value)} inputMode="numeric" required className={`${inputClass} w-28`} /></label>
      <label className={labelClass}>Regular price (₹, optional)<input value={compareAt} onChange={(event) => setCompareAt(event.target.value)} inputMode="numeric" placeholder="No offer" className={`${inputClass} w-36`} /></label>
      <button disabled={busy} className="rounded-lg bg-[#4a7333] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save price'}</button>
      <button type="button" onClick={onCancel} className="px-2 py-2 text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Cancel</button>
      {error && <p role="alert" className="basis-full text-xs text-rose-700">{error}</p>}
    </form>
  )
}
