import { useEffect, useState } from 'react'
import { GARDENS, type Garden } from '../data/products'
import { api } from './api'

/*
 * Gardens are edited in the admin dashboard, so the build-time snapshot can be
 * stale. Pages paint from the snapshot, then swap in the live list once it
 * arrives. One request per page load, shared by every caller; on failure the
 * snapshot stays and the next mount tries again.
 */

let live: Garden[] | null = null
let pending: Promise<Garden[] | null> | null = null

function loadGardens(): Promise<Garden[] | null> {
  pending ??= Promise.resolve()
    .then(() => api.gardens.list())
    .then(
    (r) => (live = r.gardens),
    () => {
      pending = null
      return null
    },
  )
  return pending
}

export function useGardens(): Garden[] {
  const [gardens, setGardens] = useState<Garden[]>(() => live ?? GARDENS)
  useEffect(() => {
    let active = true
    void loadGardens().then((g) => {
      if (active && g) setGardens(g)
    })
    return () => {
      active = false
    }
  }, [])
  return gardens
}

/** After a save in the garden editor, so the storefront reflects it without a reload. */
export function forgetLiveGardens(): void {
  live = null
  pending = null
}
