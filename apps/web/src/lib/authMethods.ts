import { api } from './api'

/* ────────────────────────────────────────────────────────────────────────────
 * Which sign-in methods the server can actually serve right now.
 *
 * WhatsApp codes need an Interakt account; until it is configured the login
 * box must open on email, not on a WhatsApp form that can only fail. Fetched
 * once per page load and shared; any failure counts as "WhatsApp off".
 * ──────────────────────────────────────────────────────────────────────────── */

export interface AuthMethods {
  whatsapp: boolean
}

let cached: AuthMethods | null = null
let pending: Promise<AuthMethods> | null = null

export const cachedAuthMethods = () => cached

export function loadAuthMethods(): Promise<AuthMethods> {
  if (cached) return Promise.resolve(cached)
  pending ??= api.auth
    .methods()
    .then((methods) => ({ whatsapp: methods.whatsapp === true }))
    .catch(() => ({ whatsapp: false }))
    .then((methods) => {
      cached = methods
      return methods
    })
  return pending
}

/** Test seam. */
export const __resetAuthMethods = () => {
  cached = null
  pending = null
}
