import { useEffect, useSyncExternalStore } from 'react'
import type { Product } from '@elegantsip/shared'
import { ALL_PRODUCTS, PRODUCTS } from '../data/products'
import { api } from './api'

/* ────────────────────────────────────────────────────────────────────────────
 * The live catalogue over the build-time snapshot.
 *
 * The snapshot (catalogue.json) paints the shop instantly and gives crawlers
 * real data, but it is only as fresh as the last catalogue sync. So once per
 * visit the storefront asks the API for the current catalogue and copies every
 * product's details (name, text, photos, packs, prices, stock, show/hide)
 * onto the snapshot's objects. Every component reads those same objects, so
 * one re-render shows whatever the admin last saved, everywhere.
 *
 * Not covered: a product that is not in the snapshot at all needs a catalogue
 * sync and deploy, and the prerendered <head> (title, description) of a page
 * keeps its snapshot text until the page has loaded.
 *
 * Checkout never relied on these figures (the server re-prices every cart).
 * If the API is unreachable the snapshot simply stays.
 * ──────────────────────────────────────────────────────────────────────────── */

let version = 0
let requested = false
const listeners = new Set<() => void>()

/**
 * Replaces each snapshot product's details (text, photos, packs, prices,
 * stock, visibility) with the live version, then rebuilds the visible list in
 * place. Returns true if anything changed. Products the API no longer returns
 * are left as they are. (Tests pass their own arrays; the defaults are the
 * storefront's.)
 */
export function applyLiveCatalogue(
  live: Product[],
  products: Product[] = ALL_PRODUCTS,
  visible: Product[] | null = products === ALL_PRODUCTS ? PRODUCTS : null,
): boolean {
  const bySlug = new Map(live.map((p) => [p.slug, p]))
  let changed = false
  for (const product of products) {
    const current = bySlug.get(product.slug)
    if (!current || JSON.stringify(product) === JSON.stringify(current)) continue
    // Same object, new contents: everything already holding it sees the update.
    Object.assign(product, current)
    changed = true
  }
  if (changed && visible) {
    // Same array object, so every module holding PRODUCTS sees the new list.
    visible.splice(0, visible.length, ...products.filter((p) => p.listed))
  }
  if (changed) {
    version += 1
    listeners.forEach((notify) => notify())
  }
  return changed
}

const subscribe = (notify: () => void) => {
  listeners.add(notify)
  return () => listeners.delete(notify)
}
const getVersion = () => version

/**
 * Fetches the live catalogue once per visit and re-renders the caller when they
 * arrive. Use it in the component that renders every page, so the whole
 * tree picks the new figures up.
 */
export function useLiveCatalogue(): number {
  useEffect(() => {
    if (requested) return
    requested = true
    api.products
      .list()
      .then(({ products }) => applyLiveCatalogue(products))
      .catch(() => {
        // Keep the snapshot; checkout re-prices on the server regardless.
      })
  }, [])
  return useSyncExternalStore(subscribe, getVersion, getVersion)
}
