/**
 * Signal fired once the ScrollExpand children content is actually visible on
 * screen. Scroll-reveal animations inside the pinned section must wait for this
 * — during the pin, the content sits at opacity 0 while document scroll
 * advances, so scroll-position triggers fire while everything is invisible.
 */

type Listener = () => void

let revealed = false
const listeners = new Set<Listener>()

/** Subscribe; fires immediately if the content has already been revealed. Returns an unsubscribe fn. */
export function onContentRevealed(callback: Listener): () => void {
  if (revealed) {
    callback()
    return () => {}
  }
  listeners.add(callback)
  return () => listeners.delete(callback)
}

/** Mark the content as revealed (called by ScrollExpand once its children fade in). */
export function markContentRevealed(): void {
  if (revealed) return
  revealed = true
  listeners.forEach((cb) => cb())
  listeners.clear()
}
