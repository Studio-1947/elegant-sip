import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { useUi } from '../UiContext'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../../lib/pricing'
import { formatINR } from '../../lib/currency'
import { COUNTRIES, type FormState } from './checkoutData'
import { api, type PincodeLocation, type SavedAddress } from '../../lib/api'

interface ShippingStepProps {
  form: FormState
  errors: Partial<Record<keyof FormState, string>>
  setField: (field: keyof FormState, value: string) => void
  inputClass: (field: keyof FormState) => string
  fieldProps: (field: keyof FormState) => { 'aria-invalid'?: boolean; 'aria-describedby'?: string }
  prefilled: boolean
  shippingMethod: ShippingMethodId
  setShippingMethod: (m: ShippingMethodId) => void
  cartTotal: number
  discount: number
  savedAddresses: SavedAddress[]
  selectSavedAddress: (address: SavedAddress) => void
  saveAddress: boolean
  setSaveAddress: (value: boolean) => void
}

type LookupStatus = 'idle' | 'loading' | 'found' | 'empty' | 'unavailable'

/** Step 1 of checkout: contact + shipping address + shipping method. */
export default function ShippingStep({
  form,
  errors,
  setField,
  inputClass,
  fieldProps,
  prefilled,
  shippingMethod,
  setShippingMethod,
  cartTotal,
  discount,
  savedAddresses,
  selectSavedAddress,
  saveAddress,
  setSaveAddress,
}: ShippingStepProps) {
  const { user } = useAuth()
  const { openLogin } = useUi()
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [locations, setLocations] = useState<PincodeLocation[]>([])
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null)

  const applyLocation = useCallback((location: PincodeLocation) => {
    setField('city', location.city)
    setField('state', location.state)
    setField('country', location.country)
    setSelectedOffice(location.officeName)
  }, [setField])

  useEffect(() => {
    const pincode = form.zip.trim()
    if (form.country !== 'India' || !/^[1-9]\d{5}$/.test(pincode)) {
      const reset = window.setTimeout(() => {
        setLookupStatus('idle')
        setLocations([])
        setSelectedOffice(null)
      }, 0)
      return () => window.clearTimeout(reset)
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setLookupStatus('loading')
      setLocations([])
      setSelectedOffice(null)
      void api.locations.pincode(pincode)
        .then((result) => {
          if (cancelled) return
          setLocations(result.locations)
          setLookupStatus(result.locations.length ? 'found' : 'empty')
          const preferred = result.locations.find((location) => location.deliveryStatus === 'Delivery') ?? result.locations[0]
          if (preferred) applyLocation(preferred)
        })
        .catch(() => !cancelled && setLookupStatus('unavailable'))
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [applyLocation, form.country, form.zip])

  const updatePincode = (value: string) => setField('zip', value.replace(/\D/g, '').slice(0, 6))

  return (
    <div>
      <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Shipping Information</h2>
      {user ? (
        prefilled && (
          <div className="bg-[#8bb56e]/5 border border-[#8bb56e]/20 rounded-xl p-4 mb-6 text-xs text-[#4a584a]">
            Welcome back, {user.name.split(' ')[0]}  we've prefilled your details from your last order.
          </div>
        )
      ) : (
        <div className="bg-[#8bb56e]/5 border border-[#8bb56e]/20 rounded-xl p-4 mb-6 text-xs text-[#4a584a] flex items-center justify-between gap-4">
          <span>Have an account? Check out faster with saved details.</span>
          <button onClick={openLogin} className="text-[#4a7333] font-bold uppercase tracking-widest hover:text-[#1b261b] transition-colors flex-shrink-0 cursor-pointer">
            Sign In
          </button>
        </div>
      )}
      {user && savedAddresses.length > 0 && (
        <fieldset className="mb-7 rounded-2xl border border-[#8bb56e]/35 bg-[#8bb56e]/5 p-4">
          <legend className="px-1 text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">Deliver to a saved address</legend>
          <p className="mb-3 text-xs text-[#4a584a]">Choose an address below to fill your shipping details instantly.</p>
          <div className="space-y-2">{savedAddresses.map((address) => <button type="button" key={address.id} onClick={() => selectSavedAddress(address)} className="w-full rounded-xl border border-[#1b261b]/15 px-4 py-3 text-left text-xs hover:border-[#8bb56e] transition-colors"><span className="font-bold">{address.label}{address.isDefaultShipping ? ' · Default shipping' : ''}</span><span className="block mt-1 text-[#4a584a]">{address.name} · {address.line1}, {address.city} {address.postalCode}</span></button>)}</div>
        </fieldset>
      )}
      <div className="space-y-4">
        <div>
          <label htmlFor="co-email" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Email</label>
          <input id="co-email" type="email" autoComplete="email" {...fieldProps('email')} value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@example.com" className={inputClass('email')} />
          {errors.email && <p id="co-email-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.email}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="co-first" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">First Name</label>
            <input id="co-first" type="text" autoComplete="given-name" {...fieldProps('firstName')} value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="Avery" className={inputClass('firstName')} />
            {errors.firstName && <p id="co-first-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="co-last" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Last Name</label>
            <input id="co-last" type="text" autoComplete="family-name" {...fieldProps('lastName')} value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Chen" className={inputClass('lastName')} />
            {errors.lastName && <p id="co-last-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.lastName}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="co-address" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Address</label>
          <input id="co-address" type="text" autoComplete="street-address" {...fieldProps('address')} value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street address" className={inputClass('address')} />
          {errors.address && <p id="co-address-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.address}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="co-city" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">City</label>
            <input id="co-city" type="text" autoComplete="address-level2" {...fieldProps('city')} value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Portland" className={inputClass('city')} />
            {errors.city && <p id="co-city-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="co-zip" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Postal / ZIP</label>
            <input id="co-zip" type="text" autoComplete="postal-code" inputMode="numeric" {...fieldProps('zip')} value={form.zip} onChange={(e) => updatePincode(e.target.value)} placeholder={form.country === 'India' ? '734101' : ''} className={inputClass('zip')} />
            {errors.zip && <p id="co-zip-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.zip}</p>}
            {lookupStatus === 'loading' && <p role="status" className="mt-1.5 text-[11px] text-[#4a584a]">Finding your locality…</p>}
            {lookupStatus === 'empty' && <p className="mt-1.5 text-[11px] text-[#4a584a]">No locality was found for this PIN. Please enter your city manually.</p>}
            {lookupStatus === 'unavailable' && <p className="mt-1.5 text-[11px] text-[#4a584a]">Location suggestions are unavailable right now. You can still enter your city manually.</p>}
          </div>
        </div>
        {lookupStatus === 'found' && locations.length > 0 && (
          <fieldset className="rounded-xl border border-[#8bb56e]/35 bg-[#8bb56e]/5 px-4 py-3">
            <legend className="px-1 text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">Locality found for this PIN</legend>
            <p className="mb-2 text-xs text-[#4a584a]">City and state have been filled from India Post. Choose the matching post office if needed.</p>
            <div className="space-y-1.5">
              {locations.map((location) => {
                const selected = selectedOffice === location.officeName
                return <button type="button" key={`${location.officeName}-${location.city}-${location.state}`} onClick={() => applyLocation(location)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selected ? 'border-[#4a7333] bg-white' : 'border-[#1b261b]/10 bg-white/60 hover:border-[#8bb56e]'}`}>
                  <span className="font-bold text-[#1b261b]">{location.officeName}</span>
                  <span className="block mt-0.5 text-[#4a584a]">{location.city}, {location.state}{location.deliveryStatus ? ` · ${location.deliveryStatus}` : ''}</span>
                </button>
              })}
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="co-country" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Country</label>
          <select
            id="co-country"
            autoComplete="country-name"
            value={form.country}
            onChange={(e) => setField('country', e.target.value)}
            className={`${inputClass('country')} cursor-pointer`}
          >
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        {user && <label className="flex items-center gap-2 text-xs text-[#4a584a]"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="accent-[#4a7333]" /> Save this as my default shipping address</label>}

        {/* Shipping method */}
        <fieldset className="pt-2">
          <legend className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-2.5">Shipping Method</legend>
          <div className="space-y-2.5">
            {SHIPPING_METHODS.map((m) => {
              const fee = getOrderPricing(cartTotal, discount, m.id).shippingFee
              const selected = shippingMethod === m.id
              return (
                <label
                  key={m.id}
                  className={`flex items-center justify-between gap-4 border rounded-xl px-4 py-3.5 cursor-pointer transition-all ${selected ? 'border-[#8bb56e] bg-[#8bb56e]/5' : 'border-[#1b261b]/15 hover:border-[#1b261b]/40'
                    }`}
                >
                  <span className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="shipping-method"
                      checked={selected}
                      onChange={() => setShippingMethod(m.id)}
                      className="accent-[#8bb56e]"
                    />
                    <span>
                      <span className="block text-sm font-bold">{m.label}</span>
                      <span className="block text-[11px] text-[#4a584a]">{m.detail}</span>
                    </span>
                  </span>
                  <span className="text-sm font-bold font-mono">{fee === 0 ? 'Free' : formatINR(fee)}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
    </div>
  )
}
