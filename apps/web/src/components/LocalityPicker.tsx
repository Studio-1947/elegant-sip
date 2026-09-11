import type { PincodeLocation } from '../lib/api'
import type { PincodeLookupStatus } from '../lib/usePincodeLookup'

interface LocalityPickerProps {
  status: PincodeLookupStatus
  locations: PincodeLocation[]
  selectedOffice: string | null
  pickerOpen: boolean
  onSelect: (location: PincodeLocation) => void
  onReopen: () => void
}

/**
 * The locality list revealed under a PIN code field once a match is found.
 * Collapses to a one-line confirmation as soon as an office is chosen, with
 * a "Change" link to bring the list back — used by both checkout shipping
 * and the account address book.
 */
export default function LocalityPicker({ status, locations, selectedOffice, pickerOpen, onSelect, onReopen }: LocalityPickerProps) {
  if (status !== 'found' || locations.length === 0) return null

  if (!pickerOpen) {
    if (!selectedOffice) return null
    return (
      <p className="text-[11px] text-[#4a584a]">
        Delivering to <span className="font-bold text-[#1b261b]">{selectedOffice}</span> ·{' '}
        <button
          type="button"
          onClick={onReopen}
          className="text-[#4a7333] font-bold uppercase tracking-widest hover:text-[#1b261b] transition-colors cursor-pointer"
        >
          Change
        </button>
      </p>
    )
  }

  return (
    <fieldset className="rounded-xl border border-[#8bb56e]/35 bg-[#8bb56e]/5 px-4 py-3">
      <legend className="px-1 text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">Locality found for this PIN</legend>
      <p className="mb-2 text-xs text-[#4a584a]">City and state have been filled from India Post. Choose the matching post office if needed.</p>
      <div className="space-y-1.5">
        {locations.map((location) => {
          const selected = selectedOffice === location.officeName
          return (
            <button
              type="button"
              key={`${location.officeName}-${location.city}-${location.state}`}
              onClick={() => onSelect(location)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                selected ? 'border-[#4a7333] bg-white' : 'border-[#1b261b]/10 bg-white/60 hover:border-[#8bb56e]'
              }`}
            >
              <span className="font-bold text-[#1b261b]">{location.officeName}</span>
              <span className="block mt-0.5 text-[#4a584a]">
                {location.city}, {location.state}
                {location.deliveryStatus ? ` · ${location.deliveryStatus}` : ''}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
