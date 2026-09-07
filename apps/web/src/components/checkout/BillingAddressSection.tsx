import { Link } from '../../lib/router'
import type { SavedAddress } from '../../lib/api'

interface BillingAddressSectionProps {
  sameAsShipping: boolean
  setSameAsShipping: (value: boolean) => void
  addresses: SavedAddress[]
  selectedAddress: SavedAddress | null
  selectAddress: (address: SavedAddress) => void
  error: string | null
}

export default function BillingAddressSection({ sameAsShipping, setSameAsShipping, addresses, selectedAddress, selectAddress, error }: BillingAddressSectionProps) {
  return (
    <fieldset className="border-t border-[#1b261b]/10 pt-6">
      <legend className="text-lg font-bold uppercase tracking-wide">Billing address</legend>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#8bb56e]/35 bg-[#8bb56e]/5 px-4 py-3.5 text-sm">
        <input type="checkbox" checked={sameAsShipping} onChange={(event) => setSameAsShipping(event.target.checked)} className="mt-0.5 accent-[#4a7333]" />
        <span><span className="block font-bold">My billing address is the same as my shipping address</span><span className="mt-0.5 block text-xs text-[#4a584a]">Use the delivery details above on your invoice.</span></span>
      </label>
      {!sameAsShipping && (
        <div className="mt-4">
          <p className="mb-3 text-xs text-[#4a584a]">Choose the address that should appear on your invoice.</p>
          {addresses.length === 0 ? <p className="rounded-xl border border-[#1b261b]/10 bg-white px-4 py-4 text-sm text-[#4a584a]">Add a billing address in <Link to="/account" className="font-bold text-[#4a7333] underline underline-offset-2">My Account</Link>, then return to checkout.</p> : <div className="space-y-2">{addresses.map((address) => {
            const selected = selectedAddress?.id === address.id
            return <button key={address.id} type="button" onClick={() => selectAddress(address)} className={`w-full rounded-xl border px-4 py-3 text-left text-xs transition-colors ${selected ? 'border-[#4a7333] bg-[#8bb56e]/5' : 'border-[#1b261b]/10 bg-white hover:border-[#8bb56e]'}`}><span className="font-bold">{address.label}{address.isDefaultBilling ? ' · Default billing' : ''}</span><span className="mt-1 block text-[#4a584a]">{address.name} · {address.line1}, {address.city} {address.postalCode}</span></button>
          })}</div>}
          {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </fieldset>
  )
}
