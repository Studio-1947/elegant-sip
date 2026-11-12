import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api'

/* ────────────────────────────────────────────────────────────────────────────
 * Shop-wide settings staff control from the admin page, as the storefront sees
 * them (GET /storefront-status). Fetched once per page load and shared.
 *
 * Until the answer arrives, and if it never does, the defaults are how the
 * shop has always behaved: the 30-day guarantee shown, guest checkout off,
 * payments unknown. Prerendered pages carry the same defaults.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface StorefrontSettings {
  /** null until the server has answered. */
  paymentsAvailable: boolean | null
  guestCheckout: boolean
  guarantee: { enabled: boolean; days: number }
  /** True once the server's answer (not the defaults) is in use. */
  loaded: boolean
}

export const DEFAULT_STOREFRONT_SETTINGS: StorefrontSettings = Object.freeze({
  paymentsAvailable: null,
  guestCheckout: false,
  guarantee: Object.freeze({ enabled: true, days: 30 }),
  loaded: false,
})

let current: StorefrontSettings = DEFAULT_STOREFRONT_SETTINGS
let pending: Promise<StorefrontSettings> | null = null
const listeners = new Set<() => void>()

const validDays = (days: unknown): days is number => Number.isInteger(days) && (days as number) >= 1 && (days as number) <= 365

export function loadStorefrontSettings(): Promise<StorefrontSettings> {
  if (current.loaded) return Promise.resolve(current)
  // Started inside a promise so even a synchronous failure falls back to the defaults.
  pending ??= Promise.resolve()
    .then(() => api.storefront.status())
    .then((status) => {
      // An older API may not send every field; anything missing keeps its default.
      current = {
        paymentsAvailable: typeof status.paymentsAvailable === 'boolean' ? status.paymentsAvailable : null,
        guestCheckout: status.guestCheckout === true,
        guarantee: {
          enabled: typeof status.guarantee?.enabled === 'boolean' ? status.guarantee.enabled : DEFAULT_STOREFRONT_SETTINGS.guarantee.enabled,
          days: validDays(status.guarantee?.days) ? status.guarantee.days : DEFAULT_STOREFRONT_SETTINGS.guarantee.days,
        },
        loaded: true,
      }
      listeners.forEach((listener) => listener())
      return current
    })
    .catch(() => {
      // Keep the defaults; the next component to mount may try again.
      pending = null
      return current
    })
  return pending
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const getSnapshot = () => current
const getServerSnapshot = () => DEFAULT_STOREFRONT_SETTINGS

export function useStoreSettings(): StorefrontSettings {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  useEffect(() => {
    void loadStorefrontSettings()
  }, [])
  return settings
}

/** Test seam. */
export const __resetStoreSettings = () => {
  current = DEFAULT_STOREFRONT_SETTINGS
  pending = null
  listeners.clear()
}
