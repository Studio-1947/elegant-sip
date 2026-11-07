import { and, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { orders, payments } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'
import { getGateway } from '../lib/gateway.js'
import { capturePayment, recordCaptureOnClosedOrder } from '../lib/capture.js'
import { guestAccessMatches } from './orders.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Checkout payment verification.
 *
 * Razorpay's browser checkout hands back { order_id, payment_id, signature }
 * on success. This endpoint lets the storefront confirm the payment straight
 * away instead of waiting for the webhook, which cannot reach a developer's
 * laptop and can lag in production.
 *
 * The signature alone is not trusted to mark the order paid. It proves the
 * payment belongs to this gateway order, then the gateway is asked
 * server-to-server for the payment's real status and amount. Only a captured
 * payment for the exact order total moves the order to paid — the same rules
 * the webhook applies, through the same capture function.
 * ──────────────────────────────────────────────────────────────────────────── */

const PAID_STATUSES = new Set(['paid', 'packed', 'shipped', 'delivered'])

export const paymentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/orders/:number/payment/verify',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Orders'],
        summary: 'Confirm a checkout payment',
        description: [
          'Send the three values Razorpay checkout returns on success. The signature is',
          'checked with HMAC-SHA256(order_id + "|" + payment_id, key secret), then the',
          'payment is looked up with Razorpay. `paid` means the order is confirmed;',
          '`pending` means the payment is authorised but not yet captured, and the',
          'webhook will finish it.',
        ].join('\n'),
        params: z.object({ number: z.string().min(3).max(40) }),
        headers: z.object({ 'x-order-access-token': z.string().min(40).max(100).optional() }).passthrough(),
        body: z.object({
          razorpay_order_id: z.string().trim().min(1).max(100),
          razorpay_payment_id: z.string().trim().min(1).max(100),
          razorpay_signature: z.string().trim().min(1).max(200),
        }),
        response: {
          200: z.object({ status: z.enum(['paid', 'pending']) }),
          400: problemSchema,
          404: problemSchema,
          409: problemSchema,
          502: problemSchema,
        },
      },
    },
    async (request) => {
      const order = await db.query.orders.findFirst({ where: eq(orders.number, request.params.number) })
      if (!order) throw ApiError.notFound('That order')

      // Same access rule as reading the order: its account, or a guest holding the checkout token.
      const permitted =
        (order.userId !== null && request.session?.userId === order.userId) ||
        guestAccessMatches(order, request.headers['x-order-access-token'])
      if (!permitted) throw ApiError.notFound('That order')

      const { razorpay_order_id: gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } =
        request.body

      const paymentRow = await db.query.payments.findFirst({
        where: and(eq(payments.orderId, order.id), eq(payments.providerOrderId, gatewayOrderId)),
      })
      if (!paymentRow) throw ApiError.badRequest('That payment does not belong to this order.')

      const gateway = getGateway()
      if (!gateway.verifyCheckoutSignature({ orderId: gatewayOrderId, paymentId, signature })) {
        request.log.warn({ orderNumber: order.number }, 'checkout signature rejected')
        throw new ApiError(400, 'invalid_signature', 'Payment not verified', 'The payment signature did not match.')
      }

      if (PAID_STATUSES.has(order.status)) return { status: 'paid' as const }

      let payment
      try {
        payment = await gateway.fetchPayment(paymentId)
      } catch (err) {
        request.log.error({ err, orderNumber: order.number }, 'payment lookup failed')
        throw new ApiError(502, 'gateway_unavailable', 'Payment check failed', 'We could not reach the payment gateway. Your order will update once payment is confirmed.')
      }
      if (!payment || payment.orderId !== gatewayOrderId) {
        throw ApiError.badRequest('That payment could not be found for this order.')
      }
      if (payment.amount !== order.total) {
        request.log.error(
          { orderNumber: order.number, expected: order.total, received: payment.amount },
          'checkout payment amount does not match order total',
        )
        throw ApiError.badRequest('The payment amount does not match this order.')
      }

      if (order.status !== 'pending_payment') {
        // Money arrived for an order that already expired or was cancelled. It
        // needs a refund, so record it and say so rather than quietly reviving it.
        if (payment.status === 'captured') {
          await recordCaptureOnClosedOrder(
            { orderNumber: order.number, paymentRowId: paymentRow.id, paymentId, method: payment.method },
            request.log,
          )
        }
        throw ApiError.conflict(
          'order_not_payable',
          'This order was cancelled before payment completed. Contact us and we will refund you.',
        )
      }

      if (payment.status === 'authorized') return { status: 'pending' as const }
      if (payment.status !== 'captured') {
        throw ApiError.badRequest('This payment has not completed.')
      }

      await capturePayment(
        { orderId: order.id, orderNumber: order.number, paymentRowId: paymentRow.id, paymentId, method: payment.method },
        request.log,
      )
      // Whether this call or a webhook did the capture, the order is now paid.
      return { status: 'paid' as const }
    },
  )
}
