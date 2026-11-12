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

  // India Post marks each post office "Delivery" or "Non-Delivery": whether that
  // branch hands out mail itself. It says nothing about whether a courier can
  // reach the address (couriers deliver by PIN), so it is not shown to buyers,
  // where it read as "we cannot deliver here". Delivering offices come first.
  const ordered = [...locations].sort(
    (a, b) => Number(b.deliveryStatus === 'Delivery') - Number(a.deliveryStatus === 'Delivery'),
  )

  return (
    <fieldset className="rounded-xl border border-[#8bb56e]/35 bg-[#8bb56e]/5 px-4 py-3">
      <legend className="px-1 text-[11px] font-mono tracking-widest uppercase text-[#4a584a]">Locality for this PIN</legend>
      <p className="mb-2 text-xs text-[#4a584a]">
        City and state are filled in from India Post. Pick the area that matches your address; couriers deliver by PIN code, so any of these is fine.
      </p>
      <div role="radiogroup" aria-label="Locality" className="space-y-2">
        {ordered.map((location) => {
          const selected = selectedOffice === location.officeName
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              key={`${location.officeName}-${location.city}-${location.state}`}
              onClick={() => onSelect(location)}
              className={`flex w-full min-h-[48px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs transition-colors ${
                selected ? 'border-[#4a7333] bg-white ring-1 ring-[#4a7333]' : 'border-[#1b261b]/10 bg-white/60 hover:border-[#8bb56e]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-4 w-4 flex-shrink-0 place-items-center rounded-full border ${
                  selected ? 'border-[#4a7333] bg-[#4a7333] text-white' : 'border-[#1b261b]/30 bg-white'
                }`}
              >
                {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0">
                <span className="font-bold text-[#1b261b]">{location.officeName}</span>
                <span className="block mt-0.5 text-[#4a584a]">
                  {location.city}, {location.state}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
