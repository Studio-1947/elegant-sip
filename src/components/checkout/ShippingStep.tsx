import { useAuth } from '../AuthContext'
import { useUi } from '../UiContext'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../../lib/pricing'
import { formatINR } from '../../lib/currency'
import { COUNTRIES, type FormState } from './checkoutData'

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
}

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
}: ShippingStepProps) {
  const { user } = useAuth()
  const { openLogin } = useUi()

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
            <input id="co-zip" type="text" autoComplete="postal-code" inputMode="numeric" {...fieldProps('zip')} value={form.zip} onChange={(e) => setField('zip', e.target.value)} placeholder={form.country === 'India' ? '734101' : ''} className={inputClass('zip')} />
            {errors.zip && <p id="co-zip-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.zip}</p>}
          </div>
        </div>
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
