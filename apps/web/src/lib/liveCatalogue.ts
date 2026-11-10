import { useEffect, useSyncExternalStore } from 'react'
import { api } from './api'
import type { Product } from '@elegantsip/shared'
import { applyLiveCatalogue, getCatalogueSnapshot, subscribeCatalogue } from '../data/products'

let inFlight: Promise<void> | null = null

/**
 * Fetch the live catalogue and overlay it on the snapshot. Once per page load
 * unless forced (the admin page forces it after a change). A failure keeps
 * the snapshot: the shop still works, with prices as of the last deploy.
 */
export function refreshCatalogue(force = false): Promise<void> {
  if (inFlight && !force) return inFlight
  inFlight = api.catalogue
    .products()
    .then(({ products }) => {
      // An empty answer is a broken API, not an empty shop.
      if (products.length > 0) applyLiveCatalogue(products)
    })
    .catch(() => {})
  return inFlight
}

/** The shop list (same items as PRODUCTS); a new array, and a re-render, whenever live data lands. */
export const useCatalogue = (): readonly Product[] =>
  useSyncExternalStore(subscribeCatalogue, getCatalogueSnapshot, getCatalogueSnapshot)

/** For the app root: starts the refresh and re-renders the page tree when it lands. */
export function useLiveCatalogue(): readonly Product[] {
  useEffect(() => {
    void refreshCatalogue()
  }, [])
  return useCatalogue()
}
