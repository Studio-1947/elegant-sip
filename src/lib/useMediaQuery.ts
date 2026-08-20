import { useEffect, useState } from 'react'

/** Reactive media query  re-renders when the viewport crosses the breakpoint. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** The app's mobile breakpoint  below Tailwind's `md`. */
export const useIsMobile = () => useMediaQuery('(max-width: 767px)')

/** Phones AND portrait tablets  below Tailwind's `lg`. The compact home experience. */
export const useIsCompact = () => useMediaQuery('(max-width: 1023px)')
