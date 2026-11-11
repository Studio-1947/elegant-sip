import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Product } from '@elegantsip/shared'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { applyLiveCatalogue } from '../../lib/liveCatalogue'
import { cardClass, errorText, quietButton } from './adminUi'
import ProductDetailsForm from './ProductDetailsForm'
import ProductPacks from './ProductPacks'
import ProductPhotos from './ProductPhotos'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner, Switch, Tabs } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Products — everything on a product card and page, editable here: photos,
 * packs (prices, stock, sizes), text, category, status and visibility.
 *
 * Reads the live catalogue, not the build-time snapshot, and every save goes
 * straight to the API. Checkout uses a change at once, the storefront on the
 * next page load, the Meta feed within 5 minutes. Once a product has been
 * edited here, the seed that runs on each deploy no longer touches it.
 * ──────────────────────────────────────────────────────────────────────────── */

type EditorTab = 'photos' | 'packs' | 'details'

const stockOf = (p: Product) => p.variants.reduce((a, v) => a + v.stock, 0)

export default function ProductsPanel({ onCount }: { onCount?: (n: number) => void }) {
  const { toast } = useFeedback()
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState<EditorTab>('photos')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  // `loading` starts true; Reload sets it before calling this. State is only
  // set from the promise callbacks, never synchronously in the effect.
  const load = useCallback(
    () =>
      api.products
        .list()
        .then(({ products: live }) => {
          setProducts(live)
          applyLiveCatalogue(live)
          onCount?.(live.length)
        })
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Could not load products.') }))
        .finally(() => setLoading(false)),
    [toast, onCount],
  )

  useEffect(() => {
    void load()
  }, [load])

  const toggleListed = async (p: Product, listed: boolean) => {
    setBusy(p.slug)
    try {
      await api.admin.setProductListed(p.slug, listed)
      toast({
        tone: 'ok',
        title: listed ? `${p.name} is visible` : `${p.name} is hidden`,
        text: listed ? 'On the shop for new visits now; back in the Meta feed within 5 minutes.' : 'Off the shop for new visits now; out of the Meta feed within 5 minutes.',
      })
      await load()
    } catch (cause) {
      toast({ tone: 'error', text: errorText(cause, 'Could not change visibility.') })
    } finally {
      setBusy(null)
    }
  }

  const current = products.find((p) => p.slug === editing) ?? null
  const saved = () => void load()

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-[#4a584a]">
          Photos, packs, prices, stock and text for every tea. Checkout uses changes at once, the shop on the next page load, the Meta feed within 5 minutes.
        </p>
        <button
          onClick={() => {
            setLoading(true)
            void load()
          }}
          disabled={loading}
          className={quietButton}
        >
          {loading ? <Spinner className="h-3.5 w-3.5" /> : '↻'} Reload
        </button>
      </div>

      {loading && products.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Empty title="No products yet" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p, i) => {
            const prices = p.variants.map((v) => v.price).filter((x) => x > 0)
            const stock = stockOf(p)
            return (
              <article
                key={p.slug}
                style={{ '--i': Math.min(i, 12) } as CSSProperties}
                className={`adm-rise group flex gap-4 p-3 ${cardClass} ${p.listed ? '' : 'opacity-70'}`}
              >
                <button
                  onClick={() => {
                    setTab('photos')
                    setEditing(p.slug)
                  }}
                  className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#f2f4ef]"
                  aria-label={`Edit photos of ${p.name}`}
                >
                  <img src={p.imageSrc} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  {p.images.length > 0 && (
                    <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">+{p.images.length}</span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-bold text-[#1b261b]">{p.name}</h3>
                    <Switch checked={p.listed} disabled={busy === p.slug} onChange={(v) => void toggleListed(p, v)} label={`Show ${p.name} on the site`} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#1b261b]/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#4a584a]">{p.category}</span>
                    {p.status === 'coming-soon' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Coming soon</span>}
                    {!p.listed && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600">Hidden</span>}
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="text-xs text-[#4a584a]">
                      <b className="text-sm text-[#1b261b]">{prices.length ? formatINR(Math.min(...prices)) : '—'}</b>
                      <span className={`ml-2 ${stock <= 5 ? 'font-semibold text-amber-700' : ''}`}>{stock} in stock</span>
                    </p>
                    <button
                      onClick={() => {
                        setTab('packs')
                        setEditing(p.slug)
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#4a7333] transition hover:bg-[#8bb56e]/15"
                    >
                      Edit →
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal open={current !== null} onClose={() => setEditing(null)} size="xl" eyebrow="Edit product" title={current?.name ?? ''}>
        {current && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <Tabs<EditorTab>
                value={tab}
                onChange={setTab}
                items={[
                  { value: 'photos', label: 'Photos', badge: 1 + current.images.length },
                  { value: 'packs', label: 'Packs & prices' },
                  { value: 'details', label: 'Details' },
                ]}
              />
              <a href={`/product/${current.slug}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#4a7333] hover:underline">
                View on site ↗
              </a>
            </div>
            {/* Keyed on the saved product so each form resets to what the API holds after a save. */}
            <div key={`${tab}-${JSON.stringify(current)}`} className="adm-rise">
              {tab === 'photos' && <ProductPhotos product={current} onSaved={saved} notify={toast} />}
              {tab === 'packs' && <ProductPacks product={current} onSaved={saved} notify={toast} />}
              {tab === 'details' && <ProductDetailsForm product={current} onSaved={saved} notify={toast} />}
            </div>
          </>
        )}
      </Modal>
    </section>
  )
}
