import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiClientError, api, type SavedAddress } from '../../lib/api'
import { usePincodeLookup } from '../../lib/usePincodeLookup'
import LocalityPicker from '../LocalityPicker'

type AddressDraft = {
  label: string
  name: string
  line1: string
  city: string
  postalCode: string
  state: string
  phone: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

const EMPTY_DRAFT: AddressDraft = {
  label: '', name: '', line1: '', city: '', postalCode: '', state: '', phone: '', isDefaultShipping: false, isDefaultBilling: false,
}

const inputClass = 'w-full rounded-lg border border-[#1b261b]/15 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#4a7333]'

function toDraft(address: SavedAddress): AddressDraft {
  return {
    label: address.label,
    name: address.name,
    line1: address.line1,
    city: address.city,
    postalCode: address.postalCode,
    state: address.state ?? '',
    phone: address.phone ?? '',
    isDefaultShipping: address.isDefaultShipping,
    isDefaultBilling: address.isDefaultBilling,
  }
}

export default function AddressBookSection() {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null)
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT)
  const [message, setMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const result = await api.account.addresses()
    setAddresses(result.addresses)
  }, [])

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      void load().catch(() => setMessage('We could not load your address book. Please refresh and try again.')).finally(() => setLoading(false))
    }, 0)
    return () => window.clearTimeout(initialLoad)
  }, [load])

  const startNew = () => {
    setEditing('new')
    setDraft({ ...EMPTY_DRAFT, isDefaultShipping: addresses.length === 0, isDefaultBilling: addresses.length === 0 })
    setMessage(null)
  }

  const startEdit = (address: SavedAddress) => {
    setEditing(address)
    setDraft(toDraft(address))
    setMessage(null)
  }

  const save = async () => {
    if (!draft.label.trim() || !draft.name.trim() || !draft.line1.trim() || !draft.city.trim() || !/^[1-9]\d{5}$/.test(draft.postalCode)) {
      setMessage('Add a label, full name, street address, city, and valid six-digit PIN code.')
      return
    }
    setSaving(true)
    setMessage(null)
    const payload = {
      ...draft,
      label: draft.label.trim(),
      name: draft.name.trim(),
      line1: draft.line1.trim(),
      city: draft.city.trim(),
      postalCode: draft.postalCode.trim(),
      state: draft.state.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      country: 'India' as const,
    }
    try {
      if (editing === 'new') await api.account.saveAddress(payload)
      else if (editing) await api.account.updateAddress(editing.id, payload)
      await load()
      setEditing(null)
      setMessage('Address book updated.')
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'We could not save this address. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // In-page confirmation instead of window.confirm: styled, readable by screen readers, and not blocked by browsers.
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const keepButton = useRef<HTMLButtonElement | null>(null)
  const sectionRef = useRef<HTMLElement | null>(null)
  // The address whose Remove button gets focus back when the question is dismissed.
  const returnFocusTo = useRef<string | null>(null)

  useEffect(() => {
    if (confirmingId) {
      keepButton.current?.focus()
    } else if (returnFocusTo.current) {
      sectionRef.current?.querySelector<HTMLButtonElement>(`[data-remove-address="${returnFocusTo.current}"]`)?.focus()
      returnFocusTo.current = null
    }
  }, [confirmingId])

  const askToRemove = (address: SavedAddress) => {
    setConfirmingId(address.id)
    setMessage(null)
  }

  const keepAddress = (address: SavedAddress) => {
    returnFocusTo.current = address.id
    setConfirmingId(null)
  }

  const remove = async (address: SavedAddress) => {
    setRemoving(true)
    setMessage(null)
    try {
      await api.account.deleteAddress(address.id)
      await load()
      setConfirmingId(null)
      setMessage('Address removed.')
    } catch (error) {
      setMessage(error instanceof ApiClientError ? error.message : 'We could not remove this address. Please try again.')
    } finally {
      setRemoving(false)
    }
  }

  const set = <K extends keyof AddressDraft>(key: K, value: AddressDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const applyLocation = useCallback((location: { city: string; state: string }) => {
    setDraft((current) => ({ ...current, city: location.city, state: location.state }))
  }, [])
  const pincodeLookup = usePincodeLookup(editing ? draft.postalCode : '', 'India', applyLocation)

  return (
    <section ref={sectionRef} aria-labelledby="address-book-heading" className="mb-12">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="address-book-heading" className="text-lg font-bold uppercase tracking-wide">Address book</h2>
          <p className="mt-1 text-xs leading-relaxed text-[#4a584a]">Keep delivery and billing details ready for your next order.</p>
        </div>
        {!editing && <button type="button" onClick={startNew} className="rounded-lg bg-[#1b261b] px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4a7333] active:translate-y-px">Add address</button>}
      </div>

      {message && <p role="status" className="mb-4 rounded-lg border border-[#8bb56e]/30 bg-[#8bb56e]/5 px-4 py-3 text-xs text-[#4a584a]">{message}</p>}

      {editing ? (
        <form onSubmit={(event) => { event.preventDefault(); void save() }} className="rounded-2xl border border-[#8bb56e]/40 bg-white p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3"><h3 className="text-sm font-bold">{editing === 'new' ? 'New address' : `Edit ${editing.label}`}</h3><button type="button" onClick={() => setEditing(null)} className="text-xs font-bold uppercase tracking-wider text-[#4a584a] hover:text-[#1b261b]">Cancel</button></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block text-xs font-medium">Label<input value={draft.label} onChange={(event) => set('label', event.target.value)} placeholder="Home or Work" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium">Full name<input value={draft.name} onChange={(event) => set('name', event.target.value)} autoComplete="name" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium sm:col-span-2">Street address<input value={draft.line1} onChange={(event) => set('line1', event.target.value)} autoComplete="street-address" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium">City<input value={draft.city} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium">State<input value={draft.state} onChange={(event) => set('state', event.target.value)} autoComplete="address-level1" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium">PIN code<input value={draft.postalCode} onChange={(event) => set('postalCode', event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" className={`${inputClass} mt-1.5`} /></label>
            <label className="block text-xs font-medium">Phone <span className="font-normal text-[#4a584a]">(optional)</span><input value={draft.phone} onChange={(event) => set('phone', event.target.value)} inputMode="tel" autoComplete="tel" className={`${inputClass} mt-1.5`} /></label>
          </div>
          <div className="mt-3">
            <LocalityPicker
              status={pincodeLookup.status}
              locations={pincodeLookup.locations}
              selectedOffice={pincodeLookup.selectedOffice}
              pickerOpen={pincodeLookup.pickerOpen}
              onSelect={pincodeLookup.selectLocation}
              onReopen={pincodeLookup.reopenPicker}
            />
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-lg border border-[#1b261b]/10 px-3.5 py-3 text-xs"><input type="checkbox" checked={draft.isDefaultShipping} onChange={(event) => set('isDefaultShipping', event.target.checked)} className="accent-[#4a7333]" /> Use as my default shipping address</label>
            <label className="flex items-center gap-2 rounded-lg border border-[#1b261b]/10 px-3.5 py-3 text-xs"><input type="checkbox" checked={draft.isDefaultBilling} onChange={(event) => set('isDefaultBilling', event.target.checked)} className="accent-[#4a7333]" /> Use as my default billing address</label>
          </div>
          <button disabled={saving} className="mt-5 rounded-lg bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4a7333] disabled:opacity-60">{saving ? 'Saving…' : 'Save address'}</button>
        </form>
      ) : loading ? (
        <div className="rounded-2xl border border-[#1b261b]/10 bg-white p-6 text-sm text-[#4a584a]">Loading your address book…</div>
      ) : addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1b261b]/20 bg-white px-6 py-8 text-sm text-[#4a584a]">No saved addresses yet. Add one now to choose it for shipping or billing at checkout.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {addresses.map((address) => <article key={address.id} className="rounded-2xl border border-[#1b261b]/10 bg-white p-5">
            <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">{address.label}</h3><p className="mt-1 text-xs text-[#4a584a]">{address.name}</p></div><div className="flex flex-wrap justify-end gap-1">{address.isDefaultShipping && <span className="rounded-md bg-[#8bb56e]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4a7333]">Shipping</span>}{address.isDefaultBilling && <span className="rounded-md bg-[#8bb56e]/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[#4a7333]">Billing</span>}</div></div>
            <p className="mt-4 text-xs leading-relaxed text-[#4a584a]">{address.line1}<br />{address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}<br />India</p>
            {confirmingId === address.id ? (
              <div
                role="group"
                aria-labelledby={`remove-address-${address.id}`}
                onKeyDown={(event) => { if (event.key === 'Escape' && !removing) keepAddress(address) }}
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3.5"
              >
                <p id={`remove-address-${address.id}`} className="text-xs font-medium text-red-900">Remove “{address.label}” from your address book?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void remove(address)} disabled={removing} className="rounded-lg bg-red-700 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-red-800 disabled:opacity-60">{removing ? 'Removing…' : 'Yes, remove'}</button>
                  <button type="button" ref={keepButton} onClick={() => keepAddress(address)} disabled={removing} className="rounded-lg border border-[#1b261b]/20 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#1b261b] hover:border-[#1b261b] disabled:opacity-60">Keep it</button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex gap-4"><button type="button" onClick={() => startEdit(address)} className="text-xs font-bold uppercase tracking-wider text-[#4a7333] hover:text-[#1b261b]">Edit</button><button type="button" data-remove-address={address.id} onClick={() => askToRemove(address)} className="text-xs font-bold uppercase tracking-wider text-red-700 hover:text-red-900">Remove</button></div>
            )}
          </article>)}
        </div>
      )}
    </section>
  )
}
