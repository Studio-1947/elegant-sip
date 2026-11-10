import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { db } from '../db/client.js'
import { orders, payments, shipments, webhookEvents } from '../db/schema-commerce.js'
import { applyTracking } from '../lib/fulfilment.js'
import { parseProviderDate } from '../lib/shipping.js'
import { env, isProduction } from '../env.js'
import { getGateway } from '../lib/gateway.js'
import { capturePayment, recordCaptureOnClosedOrder } from '../lib/capture.js'
import { reconcileRefundEvent } from '../lib/refunds.js'

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

      // refund.processed / refund.failed: settle the refund row by its gateway id.
      if (parsed.refund) {
        const outcome = await reconcileRefundEvent(parsed.eventType, parsed.refund, request.log)
        return finish(outcome.status, outcome.error)
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

          if (order.status === 'cancelled' || order.status === 'refunded') {
            await recordCaptureOnClosedOrder(
              {
                orderNumber: order.number,
                paymentRowId: paymentRow.id,
                paymentId: parsed.payment.paymentId,
                method: parsed.payment.method,
              },
              request.log,
            )
            return finish('refund_required', `Payment captured for ${order.status} order ${order.number}; refund it`)
          }
          // Already paid — a legitimate re-delivery, or the checkout verify
          // endpoint got there first.
          if (order.status !== 'pending_payment') return finish('already_paid')

          const captured = await capturePayment(
            {
              orderId: order.id,
              orderNumber: order.number,
              paymentRowId: paymentRow.id,
              paymentId: parsed.payment.paymentId,
              method: parsed.payment.method,
            },
            request.log,
          )
          return finish(captured ? 'order_paid' : 'already_paid')
        }

        case 'payment.failed': {
          /* One failed attempt is not a failed order. Razorpay keeps the same
             gateway order open and lets the customer retry with another card
             or UPI app, and "Pay now" on the order page reuses it too. So the
             order stays pending and its stock stays held; if no attempt
             succeeds, the pending-payment expiry sweep releases it. Cancelling
             here used to turn a successful retry into money taken for a
             cancelled order. */
          request.log.info({ orderNumber: order.number, paymentId: parsed.payment.paymentId }, 'payment attempt failed')
          return finish('attempt_failed')
        }

        default:
          return finish(`ignored_${parsed.eventType}`)
      }
    },
  )

  /*
   * Courier tracking (Shiprocket). Shiprocket refuses webhook URLs containing
   * "shiprocket", "kartrocket", "sr" or "kr", hence the neutral path. It
   * authenticates with the token configured in its panel, sent as x-api-key.
   */
  const courierScanSchema = z
    .object({
      date: z.string().optional(),
      activity: z.string().optional(),
      location: z.string().optional(),
      'sr-status-label': z.string().optional(),
    })
    .passthrough()
  const courierEventSchema = z
    .object({
      awb: z.union([z.string(), z.number()]).transform(String),
      current_status: z.string().optional(),
      current_timestamp: z.string().optional(),
      etd: z.string().optional(),
      scans: z.array(courierScanSchema).optional(),
    })
    .passthrough()

  app.post(
    '/webhooks/courier',
    {
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
      schema: {
        tags: ['Webhooks'],
        summary: 'Shiprocket tracking updates',
        description:
          'Authenticated by the x-api-key token set in Shiprocket → Settings → API → Webhooks. Updates the shipment and moves the order to shipped / delivered. Always 200 for an accepted token so Shiprocket does not disable the hook.',
        response: {
          200: z.object({ received: z.literal(true), status: z.string() }),
          401: z.object({ error: z.string() }),
          503: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!env.SHIPROCKET_WEBHOOK_TOKEN) return reply.status(503).send({ error: 'webhook is not configured' })
      const supplied = request.headers['x-api-key']
      const ok =
        typeof supplied === 'string' &&
        Buffer.byteLength(supplied) === Buffer.byteLength(env.SHIPROCKET_WEBHOOK_TOKEN) &&
        timingSafeEqual(Buffer.from(supplied), Buffer.from(env.SHIPROCKET_WEBHOOK_TOKEN))
      if (!ok) {
        request.log.warn('courier webhook token rejected')
        return reply.status(401).send({ error: 'invalid token' })
      }

      const parsed = courierEventSchema.safeParse(request.body)
      if (!parsed.success) return reply.send({ received: true as const, status: 'ignored_unparseable' })
      const event = parsed.data

      const eventId = `${event.awb}:${event.current_status ?? 'unknown'}:${event.current_timestamp ?? 'undated'}`
      const [inserted] = await db
        .insert(webhookEvents)
        .values({
          provider: 'shiprocket',
          eventId,
          eventType: event.current_status ?? 'unknown',
          payload: request.body as object,
        })
        .onConflictDoNothing()
        .returning({ id: webhookEvents.id })
      let eventRowId = inserted?.id
      if (!eventRowId) {
        /* Seen before. Only a finished event is a duplicate: one recorded but
           never processed (processing threw) gets another go on this retry. */
        const existing = await db.query.webhookEvents.findFirst({
          where: and(eq(webhookEvents.provider, 'shiprocket'), eq(webhookEvents.eventId, eventId)),
          columns: { id: true, processedAt: true },
        })
        if (!existing || existing.processedAt) return reply.send({ received: true as const, status: 'duplicate' })
        eventRowId = existing.id
      }

      // A cancelled shipment's old AWB must not move the parcel or the order.
      const shipment = await db.query.shipments.findFirst({
        where: and(eq(shipments.awb, event.awb), ne(shipments.status, 'cancelled')),
      })
      if (!shipment) {
        await db.update(webhookEvents).set({ processedAt: new Date(), error: 'unknown awb' }).where(eq(webhookEvents.id, eventRowId))
        return reply.send({ received: true as const, status: 'unknown_awb' })
      }

      const updated = await applyTracking(
        shipment,
        {
          providerStatus: event.current_status ?? null,
          trackingUrl: null,
          expectedDeliveryAt: parseProviderDate(event.etd),
          scans: (event.scans ?? [])
            .map((scan) => ({
              at: parseProviderDate(scan.date) ?? '',
              status: scan['sr-status-label'] || scan.activity || 'Update',
              location: scan.location || null,
              detail: scan.activity || null,
            }))
            .filter((scan) => scan.at),
        },
        request.log,
      )
      await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, eventRowId))
      return reply.send({ received: true as const, status: updated.status })
    },
  )

  const interaktEventSchema = z.object({
    version: z.string().optional(),
    timestamp: z.string().optional(),
    type: z.string().min(1).max(100),
    data: z.object({
      customer: z.object({ channel_phone_number: z.string().optional() }).passthrough().optional(),
      message: z
        .object({
          id: z.string().min(1).max(200).optional(),
          message_status: z.string().optional(),
          channel_failure_reason: z.string().nullable().optional(),
        })
        .passthrough()
        .optional(),
    }).passthrough().optional(),
  }).passthrough()

  const interaktResponseSchema = z.object({ received: z.literal(true), status: z.string() })

  const verifyInteraktSignature = (rawBody: string, signature: string | undefined) => {
    if (!env.INTERAKT_WEBHOOK_SECRET || !signature) return false
    const expected = `sha256=${createHmac('sha256', env.INTERAKT_WEBHOOK_SECRET).update(rawBody).digest('hex')}`
    const actualBytes = Buffer.from(signature)
    const expectedBytes = Buffer.from(expected)
    return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes)
  }

  const recordInteraktEvent = async (payload: z.infer<typeof interaktEventSchema>) => {
    const message = payload.data?.message
    // Interakt's message id is shared by its sent/delivered/read lifecycle.
    // Include type + timestamp so each status is preserved while retrying an
    // identical callback remains idempotent.
    const eventId = [message?.id ?? 'unknown', payload.type, payload.timestamp ?? 'undated'].join(':')
    const inserted = await db
      .insert(webhookEvents)
      .values({ provider: 'interakt', eventId, eventType: payload.type, payload })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id })
    return inserted.length === 0 ? 'duplicate' : 'recorded'
  }

  const aanganCallbackData = (payload: z.infer<typeof interaktEventSchema>): string | undefined => {
    const data = payload.data
    const message = data?.message
    const candidates = [
      payload.callbackData,
      payload.callback_data,
      data?.callbackData,
      data?.callback_data,
      message?.callbackData,
      message?.callback_data,
    ]
    return candidates.find((value): value is string => typeof value === 'string' && value.startsWith('aangan:otp:'))
  }

  /**
   * Aangan verifies the original Interakt HMAC itself. Keep the exact raw JSON and signature
   * rather than reserialising the parsed object or inventing a second trust mechanism here.
   */
  const forwardAanganEvent = async (rawBody: string, signature: string): Promise<boolean> => {
    if (!env.AANGAN_INTERAKT_WEBHOOK_URL) return false
    try {
      const response = await fetch(env.AANGAN_INTERAKT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'interakt-signature': signature },
        body: rawBody,
        signal: AbortSignal.timeout(5_000),
      })
      return response.ok
    } catch {
      return false
    }
  }

  app.post(
    '/webhooks/interakt',
    {
      config: { rateLimit: { max: 300, timeWindow: '1 minute' } },
      schema: {
        tags: ['Webhooks'],
        summary: 'Interakt WhatsApp message status callback',
        description:
          'Verifies the Interakt-Signature HMAC on the raw JSON body, then records sent, delivered, read, and failed status events.',
        response: {
          200: interaktResponseSchema,
          401: z.object({ error: z.string() }),
          502: z.object({ error: z.string() }),
          503: z.object({ error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      if (!env.INTERAKT_WEBHOOK_SECRET) {
        request.log.error('Interakt webhook received without INTERAKT_WEBHOOK_SECRET configured')
        return reply.status(503).send({ error: 'webhook is not configured' })
      }
      const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? ''
      const signature = request.headers['interakt-signature'] as string | undefined
      if (!signature || !verifyInteraktSignature(rawBody, signature)) {
        request.log.warn({ signature: Boolean(signature) }, 'Interakt webhook signature rejected')
        return reply.status(401).send({ error: 'invalid signature' })
      }

      const parsed = interaktEventSchema.safeParse(request.body)
      if (!parsed.success) return reply.send({ received: true as const, status: 'ignored_unparseable' })
      if (aanganCallbackData(parsed.data)) {
        // Acknowledging before Aangan records this would permanently lose a delivery status.
        // A 502 makes Interakt retry; Aangan's own unique constraint absorbs a retry after a
        // successful forward but failed Elegant Sip database write.
        if (!(await forwardAanganEvent(rawBody, signature))) {
          request.log.error('Aangan Interakt webhook forwarding failed')
          return reply.status(502).send({ error: 'Aangan webhook forwarding failed' })
        }
      }
      const status = await recordInteraktEvent(parsed.data)
      return reply.send({ received: true as const, status })
    },
  )

  // This exists solely for local development and integration tests. It is not
  // registered in production, so no unauthenticated callback path can exist
  // on the public service.
  if (!isProduction) {
    app.post(
      '/dev/webhooks/interakt',
      {
        schema: {
          tags: ['Webhooks'],
          summary: 'Local Interakt webhook receiver (development only)',
          response: { 200: interaktResponseSchema },
        },
      },
      async (request) => {
        const parsed = interaktEventSchema.safeParse(request.body)
        if (!parsed.success) return { received: true as const, status: 'ignored_unparseable' }
        return { received: true as const, status: await recordInteraktEvent(parsed.data) }
      },
    )
  }
}
