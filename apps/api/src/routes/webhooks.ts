import { eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '../db/client.js'
import { orders, payments, webhookEvents } from '../db/schema-commerce.js'
import { getGateway } from '../lib/gateway.js'
import { issueInvoice } from '../lib/invoice.js'
import { releaseStock, sendOrderConfirmation } from './orders.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Payment webhooks.
 *
 * This is the ONLY place an order becomes `paid`. The browser's return trip
 * from the gateway proves nothing — the customer can close the tab, lose
 * signal, or forge the redirect entirely.
 *
 * Three defences, in order:
 *
 *  1. SIGNATURE. Verified against the RAW request body, before parsing. A
 *     re-serialised body produces a different HMAC, so the raw bytes are what
 *     must be checked.
 *  2. IDEMPOTENCY. Every event is inserted into webhook_events first; the
 *     unique constraint on (provider, event_id) rejects a duplicate delivery.
 *     Razorpay retries by design, and capturing twice would be a real bug.
 *  3. AMOUNT CHECK. The captured amount must equal the order total we
 *     recorded. A mismatch is logged and left unprocessed for a human.
 *
 * The endpoint returns 200 for anything it has safely recorded, including
 * duplicates — a non-2xx makes the gateway retry, and retrying a duplicate
 * achieves nothing.
 * ──────────────────────────────────────────────────────────────────────────── */

export const webhookRoutes: FastifyPluginAsyncZod = async (app) => {
  /* The raw body is required for signature verification. Fastify's JSON parser
     would hand us a re-serialised object whose bytes differ from what was
     signed, so this route keeps the original string. */
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body: string, done) => {
      ;(req as unknown as { rawBody: string }).rawBody = body
      try {
        done(null, JSON.parse(body))
      } catch {
        done(null, {})
      }
    },
  )

  app.post(
    '/webhooks/razorpay',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Webhooks'],
        summary: 'Payment gateway callback',
        description: [
          'Signature-verified and idempotent. **This is what confirms payment** — not the',
          'browser redirect.',
          '',
          'Returns 200 for any event it has safely recorded, duplicates included, because a',
          'non-2xx would make the gateway retry a delivery that has already been handled.',
          'A bad signature returns 401 and is not recorded.',
        ].join('\n'),
        response: {
          200: z.object({ received: z.literal(true), status: z.string() }),
          401: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const gateway = getGateway()
      const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? ''
      const signature =
        (request.headers['x-razorpay-signature'] as string | undefined) ??
        (request.headers['x-webhook-signature'] as string | undefined)

      if (!gateway.verifyWebhook(rawBody, signature)) {
        request.log.warn({ signature: Boolean(signature) }, 'webhook signature rejected')
        return reply.status(401).send({ error: 'invalid signature' })
      }

      const parsed = gateway.parseWebhook(request.body)
      if (!parsed) return reply.send({ received: true as const, status: 'ignored_unparseable' })

      /* Record first. The unique constraint is the idempotency guard — if this
         insert conflicts, the event has already been handled. */
      const inserted = await db
        .insert(webhookEvents)
        .values({
          provider: gateway.name,
          eventId: parsed.eventId,
          eventType: parsed.eventType,
          payload: request.body as object,
        })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id })

      if (inserted.length === 0) {
        request.log.info({ eventId: parsed.eventId }, 'duplicate webhook ignored')
        return reply.send({ received: true as const, status: 'duplicate' })
      }
      const eventRowId = inserted[0].id

      const finish = async (status: string, error?: string) => {
        await db
          .update(webhookEvents)
          .set({ processedAt: new Date(), error: error ?? null })
          .where(eq(webhookEvents.id, eventRowId))
        return reply.send({ received: true as const, status })
      }

      if (!parsed.payment) return finish('ignored_no_payment')

      const paymentRow = await db.query.payments.findFirst({
        where: eq(payments.providerOrderId, parsed.payment.orderId),
      })
      if (!paymentRow) {
        request.log.error({ gatewayOrderId: parsed.payment.orderId }, 'webhook for unknown order')
        return finish('unknown_order', 'No payment row matches this gateway order id')
      }

      const order = await db.query.orders.findFirst({ where: eq(orders.id, paymentRow.orderId) })
      if (!order) return finish('unknown_order', 'Payment row points at a missing order')

      switch (parsed.eventType) {
        case 'payment.captured': {
          /* The amount must match exactly. A mismatch means either a bug or
             tampering; either way a human should look before we ship tea. */
          if (parsed.payment.amount !== order.total) {
            request.log.error(
              { orderNumber: order.number, expected: order.total, received: parsed.payment.amount },
              'captured amount does not match order total',
            )
            return finish(
              'amount_mismatch',
              `Expected ${order.total} paise, gateway reported ${parsed.payment.amount}`,
            )
          }

          // Already paid — a legitimate re-delivery of an event we handled.
          if (order.status !== 'pending_payment') return finish('already_paid')

          await db.transaction(async (tx) => {
            await tx
              .update(payments)
              .set({
                status: 'captured',
                providerPaymentId: parsed.payment!.paymentId,
                method: parsed.payment!.method ?? null,
                capturedAt: new Date(),
              })
              .where(eq(payments.id, paymentRow.id))
            await tx
              .update(orders)
              .set({ status: 'paid', paidAt: new Date() })
              .where(eq(orders.id, order.id))
          })

          /* Side effects run after the transaction commits and never fail the
             webhook: the payment is captured whether or not the email lands. */
          try {
            await issueInvoice(order.id)
          } catch (err) {
            request.log.error({ err, orderNumber: order.number }, 'invoice generation failed')
          }
          try {
            await sendOrderConfirmation(order.id)
          } catch (err) {
            request.log.error({ err, orderNumber: order.number }, 'confirmation email failed')
          }

          request.log.info({ orderNumber: order.number }, 'order paid')
          return finish('order_paid')
        }

        case 'payment.failed': {
          if (order.status === 'pending_payment') {
            await db.transaction(async (tx) => {
              await tx.update(payments).set({ status: 'failed' }).where(eq(payments.id, paymentRow.id))
              await tx
                .update(orders)
                .set({ status: 'cancelled', cancelledAt: new Date() })
                .where(eq(orders.id, order.id))
            })
            // Put the reserved packs back on the shelf.
            await releaseStock(order.id)
          }
          return finish('order_cancelled')
        }

        default:
          return finish(`ignored_${parsed.eventType}`)
      }
    },
  )
}
