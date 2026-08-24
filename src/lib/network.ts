/* ────────────────────────────────────────────────────────────────────────────
 * Connection hints.
 *
 * The scroll heroes download several megabytes of all-intra video. On a metered
 * or slow connection that is a real cost to the visitor, so the heroes fall
 * back to their poster image instead — the sections below the fold are
 * identical either way.
 * ──────────────────────────────────────────────────────────────────────────── */

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g'
}

function connection(): NetworkInformation | undefined {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection
}

/**
 * True when we should not pull a multi-megabyte video: the visitor has Data
 * Saver on, or the connection reports as 2G/3G. Unknown connections are treated
 * as fast, matching the previous behaviour.
 */
export function shouldSkipHeavyMedia(): boolean {
  const c = connection()
  if (!c) return false
  if (c.saveData) return true
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g' || c.effectiveType === '3g'
}
