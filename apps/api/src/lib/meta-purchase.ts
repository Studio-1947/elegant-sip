import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { FastifyBaseLogger, FastifyRequest } from 'fastify'
import { db } from '../db/client.js'
import { orderItems, orders } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { buildServerEvent, isMetaCookie, metaCapiMode, sendMetaEvents, type MetaCustomData } from './meta-capi.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Purchases reported to Meta from the server.
 *
 * The browser reports a purchase when the customer reaches the order page.
 * A customer who pays and closes the tab never gets there, so the payment
 * capture reports it too. Both use the event ID `purchase-<order number>`,
 * so Meta counts the purchase once.
 *
 * Only for customers who had accepted cookies when they checked out: the
 * checkout records that choice on the order, with Meta's cookie IDs and the
 * IP and browser Meta needs to match a website event. Those details are
 * cleared once the purchase has been reported.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Orders whose payment has been taken. */
const PAID = ['paid', 'packed', 'shipped', 'delivered'] as const

/** The order's own figures, or null when it does not exist or is unpaid. */
export async function purchaseData(number: string): Promise<MetaCustomData | null> {
  const [order] = await db
    .select({ id: orders.id, total: orders.total })
    .from(orders)
    .where(and(eq(orders.number, number), inArray(orders.status, [...PAID])))
    .limit(1)
  if (!order) return null
  const items = await db
    .select({ slug: orderItems.productSlug, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
  return {
    value: order.total / 100,
    currency: 'INR',
    content_ids: items.map((i) => i.slug),
    content_type: 'product',
    contents: items.map((i) => ({ id: i.slug, quantity: i.quantity })),
    num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    order_id: number,
  }
}

/**
 * Order columns to store at checkout. Empty unless the customer accepted
 * cookies and server events are switched on: nothing is kept for nothing.
 */
export function checkoutAdDetails(
  adConsent: boolean | undefined,
  request: Pick<FastifyRequest, 'ip' | 'headers' | 'cookies'>,
) {
  if (!adConsent || metaCapiMode() === 'off') return {}
  const fbp = request.cookies._fbp
  const fbc = request.cookies._fbc
  return {
    adConsent: true,
    metaFbp: fbp && isMetaCookie(fbp) ? fbp : null,
    metaFbc: fbc && isMetaCookie(fbc) ? fbc : null,
    metaClientIp: request.ip || null,
    metaClientUa: request.headers['user-agent']?.slice(0, 512) || null,
  }
}

/**
 * Reports a just-paid order to Meta, once. Never throws: a measurement
 * failure must not touch the payment.
 */
export async function reportPurchaseFromServer(orderId: string, log: FastifyBaseLogger): Promise<void> {
  try {
    if (metaCapiMode() === 'off') return
    // Claimed in one statement, so a webhook and a verify call racing report it once.
    const [order] = await db
      .update(orders)
      .set({ metaPurchaseSentAt: new Date() })
      .where(and(eq(orders.id, orderId), eq(orders.adConsent, true), isNull(orders.metaPurchaseSentAt)))
      .returning({
        number: orders.number,
        fbp: orders.metaFbp,
        fbc: orders.metaFbc,
        ip: orders.metaClientIp,
        ua: orders.metaClientUa,
        paidAt: orders.paidAt,
      })
    if (!order) return

    const customData = await purchaseData(order.number)
    const event = customData
      ? buildServerEvent({
          event: 'Purchase',
          eventId: `purchase-${order.number}`,
          url: new URL(`/order/${order.number}`, env.SITE_URL).toString(),
          ip: order.ip ?? undefined,
          userAgent: order.ua ?? undefined,
          fbp: order.fbp ?? undefined,
          fbc: order.fbc ?? undefined,
          customData,
          now: order.paidAt ?? undefined,
        })
      : null
    if (event) await sendMetaEvents([event], log)

    // One attempt either way; the browser's copy is the fallback. Then forget the details.
    await db
      .update(orders)
      .set({ metaFbp: null, metaFbc: null, metaClientIp: null, metaClientUa: null })
      .where(eq(orders.id, orderId))
  } catch (err) {
    log.warn({ err, orderId }, 'meta purchase report failed')
  }
}
