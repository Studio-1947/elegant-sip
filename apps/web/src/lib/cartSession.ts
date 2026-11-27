/* ────────────────────────────────────────────────────────────────────────────
 * The ID this browser's cart is saved under on the server (PUT /v1/carts/:id),
 * so staff can see carts that were left behind. A random UUID, kept with the
 * cart in localStorage; a new one starts after each order.
 * ──────────────────────────────────────────────────────────────────────────── */

const KEY = 'elegant_sip_cart_id'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Used when the browser blocks storage: the ID lasts for this page view. */
let memory: string | null = null

export function cartId(): string {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored && UUID.test(stored)) return stored
    const fresh = crypto.randomUUID()
    localStorage.setItem(KEY, fresh)
    return fresh
  } catch {
    memory ??= crypto.randomUUID()
    return memory
  }
}

/** Starts a new cart ID, after the current cart has become an order. */
export function newCartId(): void {
  memory = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored to clear.
  }
}
