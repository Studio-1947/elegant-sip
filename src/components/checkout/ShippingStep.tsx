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
          <button onClick={openLogin} className="text-[#8bb56e] font-bold uppercase tracking-widest hover:text-[#1b261b] transition-colors flex-shrink-0 cursor-pointer">
            Sign In
          </button>
        </div>
      )}
      <div className="space-y-4">
        <div>
          <label htmlFor="co-email" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Email</label>
          <input id="co-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@example.com" className={inputClass('email')} />
          {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="co-first" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">First Name</label>
            <input id="co-first" type="text" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="Avery" className={inputClass('firstName')} />
            {errors.firstName && <p className="text-[11px] text-red-600 mt-1">{errors.firstName}</p>}
          </div>
          <div>
            <label htmlFor="co-last" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Last Name</label>
            <input id="co-last" type="text" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Chen" className={inputClass('lastName')} />
            {errors.lastName && <p className="text-[11px] text-red-600 mt-1">{errors.lastName}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="co-address" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Address</label>
          <input id="co-address" type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street address" className={inputClass('address')} />
          {errors.address && <p className="text-[11px] text-red-600 mt-1">{errors.address}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="co-city" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">City</label>
            <input id="co-city" type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Portland" className={inputClass('city')} />
            {errors.city && <p className="text-[11px] text-red-600 mt-1">{errors.city}</p>}
          </div>
          <div>
            <label htmlFor="co-zip" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Postal / ZIP</label>
            <input id="co-zip" type="text" value={form.zip} onChange={(e) => setField('zip', e.target.value)} placeholder={form.country === 'India' ? '734101' : ''} className={inputClass('zip')} />
            {errors.zip && <p className="text-[11px] text-red-600 mt-1">{errors.zip}</p>}
          </div>
        </div>
        <div>
          <label htmlFor="co-country" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Country</label>
          <select
            id="co-country"
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
          <legend className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-2.5">Shipping Method</legend>
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
