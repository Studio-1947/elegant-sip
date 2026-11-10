/* ────────────────────────────────────────────────────────────────────────────
 * Print windows (invoices, packing slips).
 *
 * `window.open(…, 'noopener')` always returns null, so the page could never
 * write the document into it. Instead the window opens normally and its link
 * back to this page is cut by hand.
 *
 * Call openPrintWindow directly in the click handler, before any `await`:
 * pop-up blockers allow a window only during the click itself.
 * ──────────────────────────────────────────────────────────────────────────── */

const FEATURES = 'width=720,height=820'

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character]!)

/** Opens an empty window showing "Loading…". Null when a pop-up blocker refused it. */
export function openPrintWindow(): Window | null {
  const popup = window.open('', '_blank', FEATURES)
  if (!popup) return null
  try {
    popup.opener = null
  } catch {
    // Some browsers make opener read-only; the window is still ours to write.
  }
  popup.document.write('<!doctype html><title>Loading…</title><p style="font-family:Arial,sans-serif;margin:32px">Loading…</p>')
  return popup
}

/** Replaces the window's content with a complete HTML document. */
export function writePrintDocument(popup: Window, html: string) {
  popup.document.open()
  popup.document.write(html)
  popup.document.close()
}

export const POPUP_BLOCKED_MESSAGE = 'Your browser blocked the print window. Allow pop-ups for this site, then try again.'
