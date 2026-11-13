import { useState, type CSSProperties } from 'react'
import type { Product, ProductVariant } from '@elegantsip/shared'
import { api } from '../../lib/api'
import { formatINR } from '../../lib/currency'
import { dangerButton, errorText, inputClass, labelClass, primaryButton, quietButton, toPaise, toRupees, type Notice } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Spinner } from './ui/controls'

type Props = { product: Product; onSaved: () => void; notify: (n: Notice) => void }

/** One pack: selling price, crossed-out regular price and stock, saved together. */
function PackRow({ product, variant, onSaved, notify, index }: Props & { variant: ProductVariant; index: number }) {
  const { confirm } = useFeedback()
  const [price, setPrice] = useState(toRupees(variant.price))
  const [regular, setRegular] = useState(toRupees(variant.compareAtPrice))
  const [stock, setStock] = useState(String(variant.stock))
  const [busy, setBusy] = useState(false)

  const dirty =
    price !== toRupees(variant.price) || regular !== toRupees(variant.compareAtPrice) || stock !== String(variant.stock)
  const label = `${product.name} (${variant.size})`

  const save = async () => {
    const p = toPaise(price)
    const r = toPaise(regular)
    const s = Number(stock)
    if (p === null || Number.isNaN(p) || p <= 0) return notify({ tone: 'error', text: `${label}: enter a selling price in rupees, e.g. 861.` })
    if (Number.isNaN(r)) return notify({ tone: 'error', text: `${label}: the regular price must be rupees, or empty.` })
    if (r !== null && r <= p) return notify({ tone: 'error', text: `${label}: the regular price must be higher than the selling price, or empty.` })
    if (!Number.isInteger(s) || s < 0) return notify({ tone: 'error', text: `${label}: stock must be a whole number, 0 or more.` })

    setBusy(true)
    try {
      if (p !== variant.price || r !== variant.compareAtPrice) {
        await api.admin.updateVariantPrice(product.slug, variant.size, { price: p, compareAtPrice: r })
      }
      if (s !== variant.stock) {
        // A count, not a difference: an order placed since this form loaded must not make the shelf disagree with what was typed.
        await api.admin.adjustStock({
          productSlug: product.slug,
          variantSize: variant.size,
          setTo: s,
          reason: 'count_correction',
          note: 'Set in product editor',
        })
      }
      notify({ tone: 'ok', text: `${label} saved: ${formatINR(p)}${r ? ` (was ${formatINR(r)})` : ''}, ${s} in stock.` })
      onSaved()
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, `${label} could not be saved.`) })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Remove the ${variant.size} pack?`,
      body: `${product.name} will no longer be sold in ${variant.size}. A pack that has been ordered before can't be removed; set its stock to 0 instead.`,
      confirmLabel: 'Remove pack',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await api.admin.deleteVariant(product.slug, variant.size)
      notify({ tone: 'ok', text: `${label} removed.` })
      onSaved()
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, `${label} could not be removed.`) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      style={{ '--i': index } as CSSProperties}
      className={`adm-rise grid grid-cols-2 items-end gap-3 rounded-2xl border p-4 transition sm:grid-cols-[7rem_1fr_1fr_6rem_auto] ${dirty ? 'border-[#8bb56e] bg-[#8bb56e]/[0.06] shadow-[0_0_0_4px_rgba(139,181,110,0.12)]' : 'border-[#1b261b]/[0.08] bg-white'}`}
    >
      <div>
        <span className={labelClass}>Pack</span>
        <span className="mt-1.5 block text-base font-bold text-[#1b261b]">{variant.size}</span>
        <span className="block text-[10px] font-mono text-[#4a584a]">{variant.sku}</span>
      </div>
      <label className={labelClass}>
        Selling price ₹
        <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
      </label>
      <label className={labelClass}>
        Regular price ₹
        <input inputMode="decimal" value={regular} onChange={(e) => setRegular(e.target.value)} placeholder="No offer" className={inputClass} />
      </label>
      <label className={labelClass}>
        Stock
        <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
      </label>
      <div className="col-span-2 flex items-center justify-end gap-2 sm:col-span-1">
        {product.variants.length > 1 && (
          <button type="button" disabled={busy} onClick={() => void remove()} className={dangerButton}>
            Remove
          </button>
        )}
        <button type="submit" disabled={!dirty || busy} className={primaryButton}>
          {busy ? <Spinner className="h-3.5 w-3.5" /> : dirty ? 'Save' : 'Saved ✓'}
        </button>
      </div>
    </form>
  )
}

/** Every pack of a product, plus a form to add another size. */
export default function ProductPacks({ product, onSaved, notify }: Props) {
  const [size, setSize] = useState('')
  const [price, setPrice] = useState('')
  const [stock, setStock] = useState('0')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const p = toPaise(price)
    const s = Number(stock)
    if (!size.trim()) return notify({ tone: 'error', text: 'Give the new pack a size, e.g. 250 g.' })
    if (p === null || Number.isNaN(p) || p <= 0) return notify({ tone: 'error', text: 'Enter the new pack\'s selling price in rupees.' })
    if (!Number.isInteger(s) || s < 0) return notify({ tone: 'error', text: 'Stock must be a whole number, 0 or more.' })
    setBusy(true)
    try {
      await api.admin.addVariant(product.slug, { size: size.trim(), price: p, stock: s })
      notify({ tone: 'ok', text: `${product.name}: ${size.trim()} pack added.` })
      setSize('')
      setPrice('')
      setStock('0')
      onSaved()
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, 'The pack could not be added.') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {product.variants.map((v, i) => (
        // Keyed on the saved values so the inputs reset to them after a save.
        <PackRow key={`${v.size}-${v.price}-${v.compareAtPrice}-${v.stock}`} index={i} product={product} variant={v} onSaved={onSaved} notify={notify} />
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
        className="grid grid-cols-2 items-end gap-3 rounded-2xl border-2 border-dashed border-[#1b261b]/12 p-4 transition hover:border-[#8bb56e]/60 sm:grid-cols-[7rem_1fr_6rem_auto]"
      >
        <label className={labelClass}>
          New size
          <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="250 g" maxLength={60} className={inputClass} />
        </label>
        <label className={labelClass}>
          Selling price ₹
          <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
        </label>
        <label className={labelClass}>
          Stock
          <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
        </label>
        <button type="submit" disabled={busy} className={quietButton}>
          {busy ? 'Adding…' : '+ Add pack'}
        </button>
      </form>
      <p className="text-[11px] text-[#4a584a]">
        Prices include GST. Leave the regular price empty when there is no offer. A pack that has been ordered can't be removed; set its stock to 0 instead.
      </p>
    </div>
  )
}
