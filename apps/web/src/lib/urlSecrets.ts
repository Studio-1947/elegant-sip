/* ────────────────────────────────────────────────────────────────────────────
 * One-time tokens in email links.
 *
 * Password-reset and email-confirmation links carry `?token=…`. Left in the
 * address bar, that token would reach Google Tag Manager and the Meta Pixel in
 * every page-view URL for a visitor who accepted cookies, and anyone holding a
 * valid reset link can set the password.
 *
 * So before any tag loads, the token moves out of the URL into this tab's
 * sessionStorage (it survives a reload of the page, but not the tab) and the
 * address bar is rewritten without it. The pages read it back from here.
 * ──────────────────────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'elegant_sip_link_token'
export const TOKEN_PAGES = ['/reset-password', '/verify-email'] as const

let memory: { path: string; token: string } | null = null

/** Call once at startup, before analytics. */
export function stashUrlToken() {
  const url = new URL(window.location.href)
  if (!TOKEN_PAGES.includes(url.pathname as (typeof TOKEN_PAGES)[number])) return
  const token = url.searchParams.get('token')
  if (!token) return
  memory = { path: url.pathname, token }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // Storage blocked: the in-memory copy still covers this page view.
  }
  url.searchParams.delete('token')
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

/** The token for this page: from the URL if still there, else the stashed copy. */
export function linkToken(path: (typeof TOKEN_PAGES)[number], fromUrl: string | null): string {
  if (fromUrl) return fromUrl
  let saved = memory
  if (!saved) {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      saved = raw ? (JSON.parse(raw) as { path: string; token: string }) : null
    } catch {
      saved = null
    }
  }
  return saved && saved.path === path ? saved.token : ''
}

/** Forget the token once it has been used. */
export function clearLinkToken() {
  memory = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing stored.
  }
}
