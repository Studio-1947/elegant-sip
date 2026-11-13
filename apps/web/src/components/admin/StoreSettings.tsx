import { useEffect, useState } from 'react'
import { ApiClientError, api, type AdminStoreSettings, type AdminStoreSettingsChange } from '../../lib/api'
import { formatDateTime } from '../../lib/dates'

type Draft = { guestCheckoutEnabled: boolean; guaranteeEnabled: boolean; guaranteeDays: string; lowStockThreshold: string; newOrderAlerts: boolean }

const toDraft = (s: AdminStoreSettings): Draft => ({
  guestCheckoutEnabled: s.guestCheckoutEnabled,
  guaranteeEnabled: s.guaranteeEnabled,
  guaranteeDays: String(s.guaranteeDays),
  lowStockThreshold: String(s.lowStockThreshold),
  newOrderAlerts: s.newOrderAlerts,
})

/** A whole number in range, or the reason it is not. */
function parseWhole(input: string, label: string, min: number, max: number): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = input.trim()
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: `${label} must be a whole number.` }
  const value = Number(cleaned)
  if (value < min || value > max) return { ok: false, error: `${label} must be between ${min} and ${max.toLocaleString('en-IN')}.` }
  return { ok: true, value }
}

/**
 * Shop-wide settings: guest checkout, the satisfaction guarantee and the
 * low-stock threshold. Only what changed is sent, and "Saved" is shown only
 * after the API returns the stored row, which is then displayed as-is.
 */
export default function StoreSettings({ onSaved }: { onSaved?: () => void }) {
  const [saved, setSaved] = useState<AdminStoreSettings | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [loadError, setLoadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    api.storeSettings
      .get()
      .then((settings) => {
        if (cancelled) return
        setSaved(settings)
        setDraft(toDraft(settings))
        setLoadError('')
      })
      .catch((cause: unknown) => {
        if (!cancelled) setLoadError(cause instanceof ApiClientError ? cause.message : 'Shop settings could not be loaded.')
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const edit = (change: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...change } : current))
    setNotice('')
    setError('')
  }

  const save = async () => {
    if (!saved || !draft) return
    const days = parseWhole(draft.guaranteeDays, 'Guarantee days', 1, 365)
    const threshold = parseWhole(draft.lowStockThreshold, 'Low-stock threshold', 0, 1000)
    if (!days.ok || !threshold.ok) {
      setError(!days.ok ? days.error : !threshold.ok ? threshold.error : '')
      return
    }
    const change: AdminStoreSettingsChange = {}
    if (draft.guestCheckoutEnabled !== saved.guestCheckoutEnabled) change.guestCheckoutEnabled = draft.guestCheckoutEnabled
    if (draft.guaranteeEnabled !== saved.guaranteeEnabled) change.guaranteeEnabled = draft.guaranteeEnabled
    if (days.value !== saved.guaranteeDays) change.guaranteeDays = days.value
    if (threshold.value !== saved.lowStockThreshold) change.lowStockThreshold = threshold.value
    if (draft.newOrderAlerts !== saved.newOrderAlerts) change.newOrderAlerts = draft.newOrderAlerts
    if (Object.keys(change).length === 0) {
      setNotice('Nothing has changed.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const stored = await api.storeSettings.update(change)
      setSaved(stored)
      setDraft(toDraft(stored))
      setNotice('Saved. Pages opened from now on show it within a minute.')
      onSaved?.()
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'The settings were not saved. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const toggleClass = 'flex cursor-pointer items-start gap-3 rounded-xl border border-[#1b261b]/10 bg-[#f9faf7] px-4 py-3 text-sm'
  const numberClass = 'mt-1 block w-28 rounded-lg border border-[#1b261b]/15 bg-white px-2.5 py-1.5 text-sm text-[#1b261b]'

  return (
    <section className="mb-8 rounded-2xl border border-[#1b261b]/10 bg-white p-5" aria-labelledby="store-settings-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#4a7333]">Shop settings</span>
          <h2 id="store-settings-heading" className="mt-1 text-lg font-bold uppercase tracking-tight">Checkout, guarantee, stock &amp; alerts</h2>
        </div>
        {saved?.updatedAt && (
          <span className="text-xs text-[#4a584a]">
            Last changed {formatDateTime(saved.updatedAt)}{saved.updatedBy ? ` by ${saved.updatedBy.name || saved.updatedBy.email}` : ''}
          </span>
        )}
      </div>

      {!draft ? (
        <div className="mt-4 text-sm text-[#4a584a]">
          {loadError ? (
            <p role="alert" className="text-rose-700">
              {loadError}{' '}
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="font-bold underline underline-offset-2">Try again</button>
            </p>
          ) : (
            'Loading settings…'
          )}
        </div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); void save() }} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className={toggleClass}>
            <input type="checkbox" checked={draft.guestCheckoutEnabled} onChange={(event) => edit({ guestCheckoutEnabled: event.target.checked })} className="mt-0.5 accent-[#4a7333]" />
            <span>
              <span className="block font-bold">Guest checkout</span>
              <span className="mt-0.5 block text-xs text-[#4a584a]">Customers can order without an account. Off: everyone signs in first.</span>
            </span>
          </label>
          <div className={toggleClass}>
            <input id="store-guarantee" type="checkbox" checked={draft.guaranteeEnabled} onChange={(event) => edit({ guaranteeEnabled: event.target.checked })} className="mt-0.5 accent-[#4a7333]" />
            <span className="flex-1">
              <label htmlFor="store-guarantee" className="block cursor-pointer font-bold">Satisfaction guarantee</label>
              <span className="mt-0.5 block text-xs text-[#4a584a]">Shown on product pages, the FAQ, Shipping &amp; Returns and the Terms. Off: removed everywhere.</span>
              <label className="mt-2 block text-[10px] font-mono uppercase tracking-wider text-[#4a584a]">Days to claim
                <input value={draft.guaranteeDays} onChange={(event) => edit({ guaranteeDays: event.target.value })} inputMode="numeric" disabled={!draft.guaranteeEnabled} className={`${numberClass} disabled:opacity-50`} />
              </label>
            </span>
          </div>
          <label className={`${toggleClass} md:col-span-2`}>
            <input type="checkbox" checked={draft.newOrderAlerts} onChange={(event) => edit({ newOrderAlerts: event.target.checked })} className="mt-0.5 accent-[#4a7333]" />
            <span>
              <span className="block font-bold">Email the shop when an order is paid</span>
              <span className="mt-0.5 block text-xs text-[#4a584a]">Sends a short summary of each new paid order to the shop inbox. Off: only problems are emailed.</span>
            </span>
          </label>
          <label className="block rounded-xl border border-[#1b261b]/10 bg-[#f9faf7] px-4 py-3 text-sm md:col-span-2">
            <span className="block font-bold">Low-stock threshold</span>
            <span className="mt-0.5 block text-xs text-[#4a584a]">A pack on sale with this many or fewer left is listed under Inventory attention.</span>
            <input value={draft.lowStockThreshold} onChange={(event) => edit({ lowStockThreshold: event.target.value })} inputMode="numeric" aria-label="Low-stock threshold" className={numberClass} />
          </label>
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button disabled={busy} className="rounded-lg bg-[#1b261b] px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white hover:bg-[#4a7333] disabled:opacity-50">{busy ? 'Saving…' : 'Save settings'}</button>
            {notice && <p role="status" className="text-xs text-[#315b26]">{notice}</p>}
            {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
          </div>
        </form>
      )}
    </section>
  )
}
