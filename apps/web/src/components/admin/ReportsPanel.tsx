import { useEffect, useState, type CSSProperties } from 'react'
import { adminApi, downloadCsv, today, type SalesReport } from '../../lib/adminApi'
import { formatINR } from '../../lib/currency'
import { cardClass, errorText, inputClass, labelClass, quietButton } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Empty, Spinner } from './ui/controls'

/* ────────────────────────────────────────────────────────────────────────────
 * Reports — sales, refunds, GST and best sellers for a period (India days).
 * ──────────────────────────────────────────────────────────────────────────── */

type Preset = 'today' | '7d' | '30d' | 'month' | 'last-month' | 'fy' | 'custom'
type Range = { from: string; to: string }

const PRESETS: { value: Exclude<Preset, 'custom'>; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'fy', label: 'This financial year' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const lastDayOf = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

function rangeFor(preset: Exclude<Preset, 'custom'>): Range {
  const now = today()
  const [y, m] = now.split('-').map(Number)
  switch (preset) {
    case 'today':
      return { from: now, to: now }
    case '7d':
      return { from: today(-6), to: now }
    case '30d':
      return { from: today(-29), to: now }
    case 'month':
      return { from: `${y}-${pad(m)}-01`, to: now }
    case 'last-month': {
      const [ly, lm] = m === 1 ? [y - 1, 12] : [y, m - 1]
      return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(lastDayOf(ly, lm))}` }
    }
    case 'fy':
      // Indian financial year: 1 April to 31 March. Up to today, so never more than 366 days.
      return { from: `${m >= 4 ? y : y - 1}-04-01`, to: now }
  }
}

function Tile({ label, value, hint, index }: { label: string; value: string; hint?: string; index: number }) {
  return (
    <div style={{ '--i': index } as CSSProperties} className={`adm-rise p-4 ${cardClass}`}>
      <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#4a584a]">{label}</p>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-[#1b261b] sm:text-2xl">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[#4a584a]">{hint}</p>}
    </div>
  )
}

function DailyChart({ days }: { days: SalesReport['byDay'] }) {
  const max = Math.max(1, ...days.map((d) => d.gross))
  return (
    <figure className={`p-4 ${cardClass}`}>
      <figcaption className="mb-3 text-[10px] font-mono uppercase tracking-[0.16em] text-[#4a7333]">Gross sales by day</figcaption>
      <div role="list" aria-label="Gross sales by day" className="flex h-40 items-end gap-[2px]">
        {days.map((d) => {
          const label = `${d.day}: ${formatINR(d.gross)} from ${d.orders} order${d.orders === 1 ? '' : 's'}`
          return (
            <div key={d.day} role="listitem" aria-label={label} title={label} className="group flex h-full min-w-0 flex-1 items-end">
              <div
                className={`w-full rounded-t ${d.gross > 0 ? 'bg-[#8bb56e] group-hover:bg-[#4a7333]' : 'bg-[#1b261b]/[0.06]'}`}
                style={{ height: d.gross > 0 ? `${Math.max(3, (d.gross / max) * 100)}%` : '2px' }}
              />
            </div>
          )
        })}
      </div>
      {days.length > 0 && (
        <div className="mt-2 flex justify-between text-[10px] font-mono text-[#4a584a]">
          <span>{days[0].day}</span>
          <span>Peak {formatINR(max === 1 ? 0 : max)}</span>
          <span>{days[days.length - 1].day}</span>
        </div>
      )}
    </figure>
  )
}

export default function ReportsPanel() {
  const { toast } = useFeedback()
  const [preset, setPreset] = useState<Preset>('30d')
  const [range, setRange] = useState<Range>(() => rangeFor('30d'))
  const [draft, setDraft] = useState<Range>(range)
  const [report, setReport] = useState<SalesReport | null>(null)

  const key = `${range.from}|${range.to}`
  const current = report && `${report.from}|${report.to}` === key ? report : null

  useEffect(() => {
    let cancelled = false
    adminApi
      .sales(range)
      .then((result) => {
        if (!cancelled) setReport(result)
      })
      .catch((cause) => {
        if (!cancelled) toast({ tone: 'error', text: errorText(cause, 'The report could not be loaded.') })
      })
    return () => {
      cancelled = true
    }
  }, [range, toast])

  const choose = (value: Exclude<Preset, 'custom'>) => {
    const next = rangeFor(value)
    setPreset(value)
    setRange(next)
    setDraft(next)
  }

  const applyCustom = () => {
    if (!draft.from || !draft.to) return toast({ tone: 'error', text: 'Choose both a start and an end day.' })
    if (draft.from > draft.to) return toast({ tone: 'error', text: 'The start day must be on or before the end day.' })
    setPreset('custom')
    setRange({ ...draft })
  }

  const exportCsv = (r: SalesReport) =>
    downloadCsv(
      `elegant-sip-sales-${r.from}-to-${r.to}.csv`,
      ['Section', 'Day / tea', 'Orders / units', 'Amount (₹)'],
      [
        ['Summary', 'Net sales', r.orders, (r.net / 100).toFixed(2)],
        ['Summary', 'Gross sales', r.orders, (r.gross / 100).toFixed(2)],
        ['Summary', 'Refunds', '', (r.refunds / 100).toFixed(2)],
        ['Summary', 'GST included', r.gst.invoices, (r.tax / 100).toFixed(2)],
        ['GST', 'CGST', '', (r.gst.cgst / 100).toFixed(2)],
        ['GST', 'SGST', '', (r.gst.sgst / 100).toFixed(2)],
        ['GST', 'IGST', '', (r.gst.igst / 100).toFixed(2)],
        ...r.byDay.map((d) => ['Day', d.day, d.orders, (d.gross / 100).toFixed(2)]),
        ...r.topProducts.map((p) => ['Top tea', p.productName, p.units, (p.revenue / 100).toFixed(2)]),
      ],
    )

  return (
    <section>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => choose(p.value)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${preset === p.value ? 'bg-[#1b261b] text-white' : 'bg-white text-[#4a584a] ring-1 ring-[#1b261b]/10 hover:ring-[#8bb56e]'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            applyCustom()
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <label className={labelClass}>
            From
            <input type="date" value={draft.from} max={today()} onChange={(e) => setDraft({ ...draft, from: e.target.value })} className={inputClass} />
          </label>
          <label className={labelClass}>
            To
            <input type="date" value={draft.to} max={today()} onChange={(e) => setDraft({ ...draft, to: e.target.value })} className={inputClass} />
          </label>
          <button className={quietButton}>Show</button>
          {current && (
            <button type="button" onClick={() => exportCsv(current)} className={quietButton}>
              Export CSV
            </button>
          )}
        </form>
      </div>

      {!current ? (
        <div className="grid place-items-center py-16 text-[#4a7333]">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile index={0} label="Net sales" value={formatINR(current.net)} hint="Gross minus refunds" />
            <Tile index={1} label="Gross sales" value={formatINR(current.gross)} />
            <Tile index={2} label="Orders" value={String(current.orders)} />
            <Tile index={3} label="Average order" value={formatINR(current.averageOrder)} />
            <Tile index={4} label="Units" value={String(current.units)} hint="Packs sold" />
            <Tile index={5} label="Refunds" value={formatINR(current.refunds)} />
            <Tile index={6} label="Discounts" value={formatINR(current.discount)} />
            <Tile index={7} label="Shipping charged" value={formatINR(current.shipping)} />
          </div>
          <p className="text-[11px] text-[#4a584a]">
            {current.from} to {current.to}. Sales are counted when paid; refunds when processed. Prices include GST.
          </p>

          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <DailyChart days={current.byDay} />
            <section className={`p-4 ${cardClass}`}>
              <h3 className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#4a7333]">GST on invoices</h3>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ['Invoices issued', String(current.gst.invoices)],
                  ['CGST', formatINR(current.gst.cgst)],
                  ['SGST', formatINR(current.gst.sgst)],
                  ['IGST', formatINR(current.gst.igst)],
                  ['GST included in sales', formatINR(current.tax)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-[#4a584a]">{k}</dt>
                    <dd className="font-semibold tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          <section className={`overflow-hidden ${cardClass}`}>
            <h3 className="px-4 pt-4 text-[10px] font-mono uppercase tracking-[0.16em] text-[#4a7333]">Top teas</h3>
            {current.topProducts.length === 0 ? (
              <Empty title="No sales in this period" />
            ) : (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">
                    <th className="px-4 py-2 font-normal">Tea</th>
                    <th className="px-4 py-2 text-right font-normal">Units</th>
                    <th className="px-4 py-2 text-right font-normal">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b261b]/[0.07]">
                  {current.topProducts.map((p) => (
                    <tr key={p.productSlug}>
                      <td className="px-4 py-2.5">{p.productName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{p.units}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatINR(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
