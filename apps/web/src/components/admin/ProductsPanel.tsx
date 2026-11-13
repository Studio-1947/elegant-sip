import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import type { Product } from '@elegantsip/shared'
import { api, type OfferAction } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { refreshCatalogue } from '../../lib/liveCatalogue'
import { cardClass, errorText, primaryButton, quietButton } from './adminUi'
import AddProductForm from './AddProductForm'
import ProductDetailsForm from './ProductDetailsForm'
import ProductPacks from './ProductPacks'
import ProductPhotos from './ProductPhotos'
import OfferConfirm from './OfferConfirm'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner, Switch, Tabs } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Products — everything on a product card and page, editable here: photos,
 * packs (prices, stock, sizes, offers), text, category, status, and retiring.
 *
 * Reads the live catalogue, not the build-time snapshot, and every save goes
 * straight to the API. Checkout uses a change at once, the storefront on the
 * next page load, the Meta feed within 5 minutes. The seed that runs on each
 * deploy leaves these edits alone unless that tea's definition in code changes.
 * ──────────────────────────────────────────────────────────────────────────── */

type EditorTab = 'photos' | 'packs' | 'details'

const stockOf = (p: Product) => p.variants.reduce((a, v) => a + v.stock, 0)
/** Packs at or under the shop's low-stock threshold, counted only for a tea on sale. */
const lowPacks = (p: Product, threshold: number) =>
  p.status === 'active' && !p.archivedAt ? p.variants.filter((v) => v.stock <= threshold).length : 0

export default function ProductsPanel({ active = true }: { active?: boolean }) {
  const { toast } = useFeedback()
  const [products, setProducts] = useState<Product[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [tab, setTab] = useState<EditorTab>('photos')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [offer, setOffer] = useState<{ action: OfferAction; slug?: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [threshold, setThreshold] = useState<number | null>(null)

  // `loading` starts true; Reload sets it before calling this. State is only
  // set from the promise callbacks, never synchronously in the effect.
  const load = useCallback(
    () =>
      api.admin
        .products()
        .then(({ products: all }) => {
          setProducts(all)
          // Bring the shop pages open in this tab up to date as well.
          void refreshCatalogue(true)
        })
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Could not load products.') }))
        .finally(() => setLoading(false)),
    [toast],
  )

  // Loads when the tab is first opened and again each time it is reopened, so
  // stock changed in Inventory (or by orders) is never shown stale here.
  useEffect(() => {
    if (active) void load()
  }, [active, load])

  // The same threshold as the low-stock list and alerts (Settings).
  useEffect(() => {
    api.storeSettings
      .get()
      .then((s) => setThreshold(s.lowStockThreshold))
      .catch(() => setThreshold(null))
  }, [])

  const toggleListed = async (p: Product, onSale: boolean) => {
    setBusy(p.slug)
    try {
      // Retiring takes a tea off the shop, out of the Meta feed, and stops orders.
      await api.admin.updateProduct(p.slug, { archived: !onSale })
      toast({
        tone: 'ok',
        title: onSale ? `${p.name} is back on sale` : `${p.name} is retired`,
        text: onSale ? 'On the shop for new visits now; back in the Meta feed within 5 minutes.' : 'Off the shop and can’t be ordered; out of the Meta feed within 5 minutes.',
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
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setAdding(true)} className={primaryButton}>
            + Add tea
          </button>
          <button onClick={() => setOffer({ action: 'end-offer' })} className={quietButton}>
            End every offer…
          </button>
          <button onClick={() => setOffer({ action: 'clear-compare-at' })} className={quietButton}>
            Remove struck-out prices…
          </button>
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
            const low = threshold === null ? 0 : lowPacks(p, threshold)
            return (
              <article
                key={p.slug}
                style={{ '--i': Math.min(i, 12) } as CSSProperties}
                className={`adm-rise group flex gap-4 p-3 ${cardClass} ${p.archivedAt ? 'opacity-70' : ''}`}
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
                    <Switch checked={!p.archivedAt} disabled={busy === p.slug} onChange={(v) => void toggleListed(p, v)} label={`${p.name} on sale (off retires it)`} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-[#1b261b]/[0.05] px-2 py-0.5 text-[10px] font-medium text-[#4a584a]">{p.category}</span>
                    {p.status === 'coming-soon' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Coming soon</span>}
                    {p.archivedAt && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600">Retired</span>}
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                    <p className="text-xs text-[#4a584a]">
                      <b className="text-sm text-[#1b261b]">{prices.length ? formatINR(Math.min(...prices)) : '—'}</b>
                      <span className="ml-2">{stock} in stock</span>
                      {low > 0 && <span className="ml-2 font-semibold text-amber-700">· {low} pack{low === 1 ? '' : 's'} low</span>}
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
              {tab === 'packs' && (
                <>
                  {current.variants.some((v) => v.compareAtPrice) && (
                    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#8bb56e]/10 p-3 text-xs text-[#315b26]">
                      <span className="mr-auto">This tea has an offer running.</span>
                      <button onClick={() => setOffer({ action: 'end-offer', slug: current.slug })} className={quietButton}>
                        End offer…
                      </button>
                      <button onClick={() => setOffer({ action: 'clear-compare-at', slug: current.slug })} className={quietButton}>
                        Remove struck-out price…
                      </button>
                    </div>
                  )}
                  <ProductPacks product={current} onSaved={saved} notify={toast} />
                </>
              )}
              {tab === 'details' && <ProductDetailsForm product={current} onSaved={saved} notify={toast} />}
            </div>
          </>
        )}
      </Modal>

      <Modal open={adding} onClose={() => setAdding(false)} size="lg" eyebrow="New product" title="Add a tea">
        {adding && (
          <AddProductForm
            onCancel={() => setAdding(false)}
            onCreated={(slug) => {
              setAdding(false)
              toast({ tone: 'ok', title: 'Tea added', text: 'Add more photos, the brewing card and its garden here. New teas get their own search-engine page on the next deploy.' })
              void load().then(() => {
                setTab('photos')
                setEditing(slug)
              })
            }}
          />
        )}
      </Modal>

      {/* Ending offers: the server previews every pack it will change before anything is saved. */}
      <Modal
        open={offer !== null}
        onClose={() => setOffer(null)}
        size="md"
        eyebrow={offer?.slug ? (products.find((p) => p.slug === offer.slug)?.name ?? 'One tea') : 'Every tea'}
        title={offer?.action === 'end-offer' ? 'End offer' : 'Remove struck-out price'}
      >
        {offer && (
          <OfferConfirm
            key={`${offer.action}-${offer.slug ?? 'all'}`}
            action={offer.action}
            productSlug={offer.slug}
            onCancel={() => setOffer(null)}
            onDone={(text) => {
              setOffer(null)
              toast({ tone: 'ok', title: 'Offers updated', text })
              saved()
            }}
          />
        )}
      </Modal>
    </section>
  )
}
