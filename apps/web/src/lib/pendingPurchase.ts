/* ────────────────────────────────────────────────────────────────────────────
 * Purchases the bank confirms later.
 *
 * When Razorpay says "waiting for the bank", checkout cannot record the
 * purchase yet. It leaves a note in this tab, and the order page records the
 * purchase once the order shows as paid. Analytics de-duplicate by order
 * number, so a purchase counted twice still counts once.
 * ──────────────────────────────────────────────────────────────────────────── */

const key = (orderNumber: string) => `elegant_sip_purchase_pending_${orderNumber}`

export function rememberPendingPurchase(orderNumber: string) {
  try {
    sessionStorage.setItem(key(orderNumber), '1')
  } catch {
    // Without storage the order page's own polling still catches it.
  }
}

/** True once per pending purchase. */
export function takePendingPurchase(orderNumber: string): boolean {
  try {
    if (sessionStorage.getItem(key(orderNumber)) !== '1') return false
    sessionStorage.removeItem(key(orderNumber))
    return true
  } catch {
    return false
  }
}
