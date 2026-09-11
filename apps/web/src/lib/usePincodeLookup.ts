import { useCallback, useEffect, useState } from 'react'
import { api, type PincodeLocation } from './api'

export type PincodeLookupStatus = 'idle' | 'loading' | 'found' | 'empty' | 'unavailable'

/**
 * Looks up the post offices serving an Indian PIN code as the user types it
 * (debounced), and tracks which one is currently applied to the surrounding
 * form. `pickerOpen` starts true on a fresh match and is closed once the
 * caller selects an office, so the list of localities collapses instead of
 * staying open after a choice is made. Shared by checkout shipping and the
 * account address book so both pick-a-locality UIs behave identically.
 */
export function usePincodeLookup(pincode: string, country: string, onApply: (location: PincodeLocation) => void) {
  const [status, setStatus] = useState<PincodeLookupStatus>('idle')
  const [locations, setLocations] = useState<PincodeLocation[]>([])
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const applyLocation = useCallback(
    (location: PincodeLocation) => {
      onApply(location)
      setSelectedOffice(location.officeName)
    },
    [onApply],
  )

  useEffect(() => {
    const trimmed = pincode.trim()
    if (country !== 'India' || !/^[1-9]\d{5}$/.test(trimmed)) {
      const reset = window.setTimeout(() => {
        setStatus('idle')
        setLocations([])
        setSelectedOffice(null)
        setPickerOpen(false)
      }, 0)
      return () => window.clearTimeout(reset)
    }

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setStatus('loading')
      setLocations([])
      setSelectedOffice(null)
      setPickerOpen(false)
      void api.locations
        .pincode(trimmed)
        .then((result) => {
          if (cancelled) return
          setLocations(result.locations)
          setStatus(result.locations.length ? 'found' : 'empty')
          setPickerOpen(result.locations.length > 0)
          const preferred = result.locations.find((location) => location.deliveryStatus === 'Delivery') ?? result.locations[0]
          if (preferred) applyLocation(preferred)
        })
        .catch(() => !cancelled && setStatus('unavailable'))
    }, 300)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [applyLocation, country, pincode])

  const selectLocation = useCallback(
    (location: PincodeLocation) => {
      applyLocation(location)
      setPickerOpen(false)
    },
    [applyLocation],
  )

  return { status, locations, selectedOffice, pickerOpen, reopenPicker: () => setPickerOpen(true), selectLocation }
}
