import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { adminApi, downloadCsv, today, type InventoryRow } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { cardClass, errorText, inputClass, quietButton } from './adminUi'
import { AdjustStock, StockHistory, WeightEditor } from './InventoryDialogs'
import { useFeedback } from './ui/Feedback'
import Modal from './ui/Modal'
import { Empty, Spinner, Switch } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Inventory — every pack of every tea in one list: what can be sold, what
 * unpaid checkouts are holding, packed weight for the courier, and low stock
 * against the shop threshold. Counts, write-offs and restocks go through the
 * stock ledger with a reason; History shows every movement.
 * ──────────────────────────────────────────────────────────────────────────── */

const keyOf = (r: { productSlug: string; size: string }) => `${r.productSlug}::${r.size}`

export default function InventoryPanel() {
  const { toast } = useFeedback()
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [threshold, setThreshold] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [hideRetired, setHideRetired] = useState(true)
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null)
  const [weighing, setWeighing] = useState<string | null>(null)
  const [history, setHistory] = useState<{ row: InventoryRow | null } | null>(null)

  const load = useCallback(
    () =>
      adminApi
        .inventory()
        .then((r) => {
          setRows(r.variants)
          setThreshold(r.threshold)
        })
        .catch((cause) => toast({ tone: 'error', text: errorText(cause, 'Inventory could not be loaded.') }))
        .finally(() => setLoading(false)),
    [toast],
  )

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!hideRetired || !r.retired) &&
        (!lowOnly || r.low) &&
        (!term || `${r.productName} ${r.size} ${r.sku}`.toLowerCase().includes(term)),
    )
  }, [rows, search, lowOnly, hideRetired])

  const totals = useMemo(
    () => ({
      packs: shown.reduce((a, r) => a + r.stock, 0),
      held: shown.reduce((a, r) => a + r.held, 0),
      low: rows.filter((r) => r.low).length,
    }),
    [shown, rows],
  )

  const exportCsv = () =>
    downloadCsv(
      `elegant-sip-inventory-${today()}.csv`,
      ['Tea', 'Pack', 'SKU', 'Price (₹)', 'In stock', 'Held by unpaid checkouts', 'Weight (g)', 'Weight set', 'Status', 'Low'],
      shown.map((r) => [
        r.productName,
        r.size,
        r.sku,
        (r.price / 100).toFixed(2),
        r.stock,
        r.held,
        r.weightGrams,
        r.weightIsSet ? 'yes' : 'from label',
        r.retired ? 'retired' : r.productStatus,
        r.low ? 'yes' : '',
      ]),
    )

  const reload = () => {
    setLoading(true)
    void load()
  }

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-[#4a584a]">
          Every pack and its stock. Unpaid checkouts hold packs for up to 30 minutes; they come back if the payment doesn't.
          {threshold !== null && <> Low means {threshold} or fewer left (Settings).</>}
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setHistory({ row: null })} className={quietButton}>Stock history</button>
          <button onClick={exportCsv} disabled={shown.length === 0} className={quietButton}>Export CSV</button>
          <button onClick={reload} disabled={loading} className={quietButton}>
            {loading ? <Spinner className="h-3.5 w-3.5" /> : '↻'} Reload
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tea, pack or SKU" aria-label="Search inventory" className={`${inputClass} mt-0 max-w-xs`} />
        <label className="flex items-center gap-2 text-xs font-semibold text-[#4a584a]">
          <Switch checked={lowOnly} onChange={setLowOnly} label="Low stock only" /> Low only{totals.low > 0 ? ` (${totals.low})` : ''}
        </label>
        <label className="flex items-center gap-2 text-xs font-semibold text-[#4a584a]">
          <Switch checked={hideRetired} onChange={setHideRetired} label="Hide retired teas" /> Hide retired
        </label>
        <span className="ml-auto text-xs text-[#4a584a]">
          {shown.length} packs · <b className="text-[#1b261b]">{totals.packs}</b> in stock{totals.held > 0 ? ` · ${totals.held} held` : ''}
        </span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-14 rounded-2xl" />)}</div>
      ) : shown.length === 0 ? (
        <div className={cardClass}><Empty title={rows.length ? 'Nothing matches these filters' : 'No packs yet'} /></div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#1b261b]/[0.08] bg-white">
          <div className="hidden grid-cols-[minmax(0,2fr)_6rem_5rem_5rem_5rem_7rem_15rem] gap-3 border-b border-[#1b261b]/[0.07] bg-[#f9faf7] px-4 py-2.5 text-[10px] font-mono uppercase tracking-[0.14em] text-[#4a584a] md:grid">
            <span>Tea · pack</span><span className="text-right">Price</span><span className="text-right">Stock</span><span className="text-right">Held</span><span className="text-right">Weight</span><span /><span className="text-right">Actions</span>
          </div>
          <ul className="divide-y divide-[#1b261b]/[0.07]">
            {shown.map((r, i) => (
              <li key={keyOf(r)} style={{ '--i': Math.min(i, 12) } as CSSProperties} className={`adm-rise px-4 py-3 ${r.retired ? 'opacity-60' : ''}`}>
                <div className="grid grid-cols-2 items-center gap-3 md:grid-cols-[minmax(0,2fr)_6rem_5rem_5rem_5rem_7rem_15rem]">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="truncate text-sm font-bold text-[#1b261b]">{r.productName} <span className="font-normal text-[#4a584a]">· {r.size}</span></p>
                    <p className="font-mono text-[10px] text-[#4a584a]">{r.sku}</p>
                  </div>
                  <span className="text-sm md:text-right"><span className="text-[10px] text-[#4a584a] md:hidden">Price </span>{formatINR(r.price)}</span>
                  <span className="text-right md:text-right">
                    <span className="text-[10px] text-[#4a584a] md:hidden">Stock </span>
                    <b className={`rounded-lg px-2 py-0.5 font-mono text-sm ${r.stock === 0 ? 'bg-rose-100 text-rose-700' : r.low ? 'bg-amber-100 text-amber-800' : 'text-[#1b261b]'}`}>{r.stock}</b>
                  </span>
                  <span className="text-sm text-[#4a584a] md:text-right"><span className="text-[10px] md:hidden">Held </span>{r.held || '—'}</span>
                  <span className="text-right text-sm text-[#4a584a]">
                    <span className="text-[10px] md:hidden">Weight </span>{r.weightGrams} g
                    {!r.weightIsSet && <span className="block text-[9px] uppercase tracking-wider text-[#4a584a]/70">from label</span>}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {r.low && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Low</span>}
                    {r.retired && <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600">Retired</span>}
                    {!r.retired && r.productStatus === 'coming-soon' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Coming soon</span>}
                  </span>
                  <span className="col-span-2 flex flex-wrap justify-end gap-1.5 md:col-span-1">
                    <button onClick={() => setAdjusting(r)} className={quietButton}>Adjust…</button>
                    <button onClick={() => setWeighing(weighing === keyOf(r) ? null : keyOf(r))} className={quietButton}>Weight…</button>
                    <button onClick={() => setHistory({ row: r })} className={quietButton}>History</button>
                  </span>
                </div>
                {weighing === keyOf(r) && (
                  <div className="adm-rise mt-3 rounded-xl bg-[#f9faf7] p-3">
                    <WeightEditor row={r} onCancel={() => setWeighing(null)} onDone={() => { setWeighing(null); reload() }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={adjusting !== null} onClose={() => setAdjusting(null)} size="md" eyebrow="Adjust stock" title={adjusting ? `${adjusting.productName} · ${adjusting.size}` : ''}>
        {adjusting && <AdjustStock key={keyOf(adjusting)} row={adjusting} onCancel={() => setAdjusting(null)} onDone={() => { setAdjusting(null); reload() }} />}
      </Modal>

      <Modal
        open={history !== null}
        onClose={() => setHistory(null)}
        size="lg"
        eyebrow="Stock history"
        title={history?.row ? `${history.row.productName} · ${history.row.size}` : 'Every tea'}
      >
        {history && <StockHistory key={history.row ? keyOf(history.row) : 'all'} row={history.row} />}
      </Modal>
    </section>
  )
}
