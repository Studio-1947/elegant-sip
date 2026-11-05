import { and, eq } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { db } from '../db/client.js'
import { orders, payments } from '../db/schema-commerce.js'
import { issueInvoice } from './invoice.js'
import { sendOrderConfirmation } from '../routes/orders.js'

/**
 * Moves a pending order to `paid`. Shared by the webhook and the checkout
 * verify endpoint, so whichever arrives first wins and the other is a no-op.
 *
 * The transition is conditional on `pending_payment`: the expiry worker may
 * have cancelled the order, and a late payment must not revive it.
 *
 * Returns false when the order was no longer pending.
 */
export async function capturePayment(
  input: { orderId: string; orderNumber: string; paymentRowId: string; paymentId: string; method?: string | null },
  log: FastifyBaseLogger,
): Promise<boolean> {
  const captured = await db.transaction(async (tx) => {
    const transitioned = await tx
      .update(orders)
      .set({ status: 'paid', paidAt: new Date() })
      .where(and(eq(orders.id, input.orderId), eq(orders.status, 'pending_payment')))
      .returning({ id: orders.id })
    if (transitioned.length === 0) return false
    await tx
      .update(payments)
      .set({
        status: 'captured',
        providerPaymentId: input.paymentId,
        method: input.method ?? null,
        capturedAt: new Date(),
      })
      .where(eq(payments.id, input.paymentRowId))
    return true
  })
  if (!captured) return false

  /* Side effects run after the transaction commits and never undo the
     capture: the payment is taken whether or not the email lands. */
  try {
    await issueInvoice(input.orderId)
  } catch (err) {
    log.error({ err, orderNumber: input.orderNumber }, 'invoice generation failed')
  }
  try {
    await sendOrderConfirmation(input.orderId)
  } catch (err) {
    log.error({ err, orderNumber: input.orderNumber }, 'confirmation email failed')
  }

  log.info({ orderNumber: input.orderNumber }, 'order paid')
  return true
}
