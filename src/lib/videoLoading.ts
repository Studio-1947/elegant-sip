/* ────────────────────────────────────────────────────────────────────────────
 * Hero video download progress  reported by whichever hero video is mounted
 * (desktop or mobile), read by the loading overlay so it can hold until the
 * scroll animation is actually ready to play.
 * ──────────────────────────────────────────────────────────────────────────── */

let progress = 0

/** Report the buffered fraction (0..1). Monotonic  regressions are ignored. */
export function reportVideoProgress(fraction: number) {
  progress = Math.max(progress, Math.min(1, fraction))
}

export function getVideoProgress(): number {
  return progress
}

/** A failed video must never trap the visitor on the loader. */
export function markVideoFailed() {
  progress = 1
}
