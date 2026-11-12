import { eq } from 'drizzle-orm'
import { formatPaise } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { alertStaff } from './alerts.js'
import { sendEmail } from './email.js'
import { getStoreSettings } from './settings.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Order messages that are not part of payment or the courier: the staff
 * heads-up for a new paid order, and the customer's notes when staff cancel an
 * order or decide on a cancellation or return request.
 *
 * Callers run these after the change is committed. sendEmail never throws, and
 * a failed delivery is queued in the outbox for a retry.
 * ──────────────────────────────────────────────────────────────────────────── */

type OrderRef = { email: string; number: string; shippingName: string }

const orderLink = (number: string) => ({ label: 'View your order', url: `${env.SITE_URL}/order/${encodeURIComponent(number)}` })

/** Emails the shop inbox about a newly paid order, unless turned off in Shop settings. */
export async function alertNewOrder(orderId: string): Promise<void> {
  if (!(await getStoreSettings()).newOrderAlerts) return
  const row = await db.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } })
  if (!row) return
  await alertStaff({
    subject: `New order ${row.number} · ${formatPaise(row.total)}`,
    body: ['A new order has been paid and is waiting to be packed. Open Orders → To pack on the staff page.'],
    facts: [
      ...row.items.map((i) => [`${i.productName} (${i.variantSize})`, `× ${i.quantity}`] as [string, string]),
      ['Total', formatPaise(row.total)],
      ['Deliver to', `${row.shippingName}, ${row.shippingCity} ${row.shippingPostalCode}`],
      ...(row.notes ? ([['Customer note', row.notes]] as [string, string][]) : []),
    ],
  })
}

/** Tells the customer their order was cancelled, and whether money is coming back. */
export function sendCancelledEmail(order: OrderRef, options: { refundDue: boolean; reason?: string | null }) {
  return sendEmail({
    kind: 'order_cancelled',
    to: order.email,
    subject: `Order ${order.number} has been cancelled`,
    heading: 'Your order has been cancelled',
    body: [
      `${order.shippingName}, order ${order.number} has been cancelled and will not be sent.`,
      ...(options.reason ? [options.reason] : []),
      options.refundDue
        ? 'Your payment will be refunded to the original payment method. We will email you once the refund is issued; banks usually take 5–7 working days to show it.'
        : 'No payment is due for this order.',
    ],
    facts: [['Order', order.number]],
    action: orderLink(order.number),
    footnote: 'Questions? Reply to this email and a person will answer.',
    replyTo: env.CONTACT_INBOX,
  })
}

export type ReturnDecision = 'approved' | 'rejected' | 'received'

/** Tells the customer what happened to their cancellation or return request. */
export function sendReturnDecisionEmail(
  order: OrderRef,
  request: { type: 'cancellation' | 'return'; staffNote?: string | null },
  decision: ReturnDecision,
) {
  const what = request.type === 'cancellation' ? 'cancellation' : 'return'
  const copy: Record<ReturnDecision, { subject: string; heading: string; body: string[] }> = {
    approved:
      request.type === 'cancellation'
        ? {
            subject: `Cancellation approved for ${order.number}`,
            heading: 'Your cancellation is approved',
            body: ['We have cancelled your order before it shipped. Your refund will follow to the original payment method, and we will email you when it is issued.'],
          }
        : {
            subject: `Return approved for ${order.number}`,
            heading: 'Your return is approved',
            body: ['Please send the tea back to us. Reply to this email if you need the return address or help arranging a pickup. We refund once the parcel reaches us.'],
          },
    rejected: {
      subject: `About your ${what} request for ${order.number}`,
      heading: `We could not accept this ${what}`,
      body: [`We have looked at your ${what} request for order ${order.number} and cannot accept it as it stands.`, 'You can reply to this email, or send a new request from your order page with more detail.'],
    },
    received: {
      subject: `Return received for ${order.number}`,
      heading: 'We have your return',
      body: ['Your returned parcel has reached us. Your refund will follow to the original payment method, and we will email you when it is issued.'],
    },
  }
  const message = copy[decision]
  return sendEmail({
    kind: `return_${decision}`,
    to: order.email,
    subject: message.subject,
    heading: message.heading,
    body: [`${order.shippingName},`, ...message.body, ...(request.staffNote ? [`Note from us: ${request.staffNote}`] : [])],
    facts: [['Order', order.number]],
    action: orderLink(order.number),
    replyTo: env.CONTACT_INBOX,
  })
}
