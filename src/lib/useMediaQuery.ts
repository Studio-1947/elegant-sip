import { useCallback, useSyncExternalStore } from 'react'

/**
 * Reactive media query — re-renders when the viewport crosses the breakpoint.
 *
 * `useSyncExternalStore` is the right primitive here: the match state lives in
 * the browser, not React. The previous useState + useEffect version re-read and
 * re-set the value on mount, costing an extra render on every component that
 * used it (and the home experience uses it to pick which variant to load).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])

  return useSyncExternalStore(subscribe, getSnapshot)
}

/** The app's mobile breakpoint — below Tailwind's `md`. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')

/** Phones AND portrait tablets — below Tailwind's `lg`. The compact home experience. */
export const useIsCompact = () => useMediaQuery('(max-width: 1023px)')
