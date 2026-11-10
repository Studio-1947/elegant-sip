import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Payment gateway.
 *
 * An interface with two implementations. Razorpay is the real one; `fake` is a
 * faithful stand-in that signs webhooks with the same HMAC-SHA256 scheme, so
 * the entire checkout path — order creation, signature verification,
 * idempotency, capture — is exercised by tests without any credentials.
 *
 * The point of the seam is that the fake is not a stub. It fails the same way
 * the real gateway does: a tampered payload fails verification, a replayed
 * event is rejected by the caller's idempotency check.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface GatewayOrder {
  /** The gateway's own order id, e.g. order_Nq3x9... */
  id: string
  /** Paise. */
  amount: number
  currency: string
  /** Public key the browser checkout widget needs. */
  publicKey: string
}

export interface GatewayPayment {
  paymentId: string
  orderId: string
  amount: number
  method?: string
}

/** A payment as the gateway itself reports it, fetched server-to-server. */
export interface GatewayPaymentStatus extends GatewayPayment {
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed'
}

/** A refund as a webhook reports it. */
export interface GatewayRefundEvent {
  refundId: string
  paymentId: string
  /** Paise. */
  amount: number
  notes: Record<string, string>
}

export interface RefundRequest {
  /** The gateway's payment id, e.g. pay_Nq3x9... */
  paymentId: string
  /** Paise. */
  amount: number
  /** Our refund row id. Echoed back by the gateway so a webhook can find the row. */
  receipt: string
  notes?: Record<string, string>
}

/**
 * What the gateway said about a refund request.
 *  · processed / pending: accepted; pending settles later by webhook.
 *  · failed: refused outright. Nothing was refunded, so it is safe to try again.
 *  · unknown: no clear answer (timeout, 5xx). Money may have moved, so the
 *    caller must not treat it as failed.
 */
export type GatewayRefundResult =
  | { status: 'processed'; refundId: string }
  | { status: 'pending'; refundId: string }
  | { status: 'failed'; reason: string }
  | { status: 'unknown'; reason: string }

export interface CheckoutResponse {
  orderId: string
  paymentId: string
  signature: string
}

export interface PaymentGateway {
  readonly name: string
  createOrder(input: { amount: number; receipt: string; notes?: Record<string, string> }): Promise<GatewayOrder>
  /**
   * Checks the signature the browser checkout returns on success:
   * HMAC-SHA256(order_id + "|" + payment_id) keyed with the API key secret.
   */
  verifyCheckoutSignature(response: CheckoutResponse): boolean
  /** Asks the gateway directly for a payment's state. Null when it does not exist. */
  fetchPayment(paymentId: string): Promise<GatewayPaymentStatus | null>
  /**
   * Every payment attempt made against one gateway order, as the gateway
   * reports it. Used to reconcile before an unpaid order is expired, in case
   * the webhook and the browser verify call were both lost.
   */
  fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPaymentStatus[]>
  /** Constant-time signature check over the raw request body. */
  verifyWebhook(rawBody: string, signature: string | undefined): boolean
  /** Asks the gateway to return money to the customer. Never throws. */
  refundPayment(input: RefundRequest): Promise<GatewayRefundResult>
  /** Normalises a provider payload into the shape the handler needs. */
  parseWebhook(payload: unknown): ParsedWebhook | null
}

export interface ParsedWebhook {
  eventId: string
  eventType: string
  payment: GatewayPayment | null
  refund: GatewayRefundEvent | null
}

type WebhookBody = {
  event?: string
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; method?: string } }
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; notes?: unknown } }
  }
}

/** Razorpay sends empty notes as `[]`; only string values are kept. */
const stringNotes = (notes: unknown): Record<string, string> =>
  notes && typeof notes === 'object' && !Array.isArray(notes)
    ? Object.fromEntries(Object.entries(notes).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}

const parseRefundEntity = (body: WebhookBody): GatewayRefundEvent | null => {
  const entity = body.payload?.refund?.entity
  if (!entity?.id || !entity.payment_id || typeof entity.amount !== 'number') return null
  return { refundId: entity.id, paymentId: entity.payment_id, amount: entity.amount, notes: stringNotes(entity.notes) }
}

/** Gateway error text is shown to staff, so keep it short and printable. */
const cleanReason = (text: unknown, fallback: string): string => {
  if (typeof text !== 'string') return fallback
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point.
  const cleaned = text.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, 200)
  return cleaned || fallback
}

const safeCompare = (a: string, b: string): boolean => {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

/* ── Razorpay ─────────────────────────────────────────────────────────────── */

class RazorpayGateway implements PaymentGateway {
  readonly name = 'razorpay'

  constructor(
    private readonly keyId: string,
    private readonly keySecret: string,
    private readonly webhookSecret: string,
  ) {}

  async createOrder(input: { amount: number; receipt: string; notes?: Record<string, string> }): Promise<GatewayOrder> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: input.amount, // already paise
        currency: 'INR',
        receipt: input.receipt,
        notes: input.notes,
      }),
      // Called inside the checkout transaction, which holds stock row locks.
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Razorpay order creation failed (${response.status}): ${detail}`)
    }
    const body = (await response.json()) as { id: string; amount: number; currency: string }
    return { id: body.id, amount: body.amount, currency: body.currency, publicKey: this.keyId }
  }

  verifyCheckoutSignature({ orderId, paymentId, signature }: CheckoutResponse): boolean {
    const expected = createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex')
    return safeCompare(expected, signature)
  }

  async fetchPayment(paymentId: string): Promise<GatewayPaymentStatus | null> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (response.status === 400 || response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Razorpay payment lookup failed (${response.status}): ${await response.text()}`)
    }
    const body = (await response.json()) as {
      id: string
      order_id: string
      amount: number
      method?: string
      status: GatewayPaymentStatus['status']
    }
    return { paymentId: body.id, orderId: body.order_id, amount: body.amount, method: body.method, status: body.status }
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPaymentStatus[]> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(gatewayOrderId)}/payments`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!response.ok) {
      throw new Error(`Razorpay order payments lookup failed (${response.status}): ${await response.text()}`)
    }
    const body = (await response.json()) as {
      items?: { id: string; order_id: string; amount: number; method?: string; status: GatewayPaymentStatus['status'] }[]
    }
    return (body.items ?? []).map((p) => ({
      paymentId: p.id,
      orderId: p.order_id,
      amount: p.amount,
      method: p.method,
      status: p.status,
    }))
  }

  async refundPayment(input: RefundRequest): Promise<GatewayRefundResult> {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')
    let response: Response
    try {
      response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refund`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: input.amount, speed: 'normal', receipt: input.receipt, notes: input.notes }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch (error) {
      // The request may have reached Razorpay before the connection dropped.
      const timedOut = error instanceof Error && error.name === 'TimeoutError'
      return { status: 'unknown', reason: timedOut ? 'Razorpay did not answer in time.' : 'Razorpay could not be reached.' }
    }
    const body = (await response.json().catch(() => null)) as {
      id?: string
      status?: string
      error?: { description?: string }
    } | null
    if (response.ok && body?.id) {
      if (body.status === 'processed') return { status: 'processed', refundId: body.id }
      if (body.status === 'failed') return { status: 'failed', reason: 'Razorpay marked the refund as failed.' }
      return { status: 'pending', refundId: body.id }
    }
    // A 4xx is a refusal: Razorpay created no refund. Anything else is ambiguous.
    if (response.status >= 400 && response.status < 500) {
      return { status: 'failed', reason: cleanReason(body?.error?.description, `Razorpay refused the refund (${response.status}).`) }
    }
    return { status: 'unknown', reason: `Razorpay answered ${response.status}.` }
  }

  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex')
    return safeCompare(expected, signature)
  }

  parseWebhook(payload: unknown): ParsedWebhook | null {
    const body = payload as WebhookBody
    if (!body?.event) return null
    const entity = body.payload?.payment?.entity
    const payment =
      entity?.id && entity.order_id
        ? { paymentId: entity.id, orderId: entity.order_id, amount: entity.amount ?? 0, method: entity.method }
        : null
    const refund = parseRefundEntity(body)
    // Razorpay does not send a top-level event id. The payment id plus the
    // event type is the stable dedupe key; a refund event uses the refund id,
    // because one payment can have several refunds.
    const subject = refund?.refundId ?? entity?.id ?? randomBytes(8).toString('hex')
    return { eventId: `${body.event}:${subject}`, eventType: body.event, payment, refund }
  }
}

/* ── Fake ─────────────────────────────────────────────────────────────────── */

/**
 * Development and test gateway. Same signing scheme, same payload shape, no
 * network. `simulatePayment()` produces a correctly signed webhook body so a
 * test can drive the full capture path.
 */
export class FakeGateway implements PaymentGateway {
  readonly name = 'fake'
  private readonly secret = env.RAZORPAY_WEBHOOK_SECRET ?? 'fake-webhook-secret'
  private static readonly keySecret = 'fake-key-secret'
  /** Shared across instances so a test's gateway and the app's gateway agree. */
  private static readonly payments = new Map<string, GatewayPaymentStatus>()

  async createOrder(input: { amount: number; receipt: string }): Promise<GatewayOrder> {
    return {
      id: `order_fake_${randomBytes(9).toString('hex')}`,
      amount: input.amount,
      currency: 'INR',
      publicKey: 'rzp_test_fake',
    }
  }

  verifyCheckoutSignature({ orderId, paymentId, signature }: CheckoutResponse): boolean {
    const expected = createHmac('sha256', FakeGateway.keySecret).update(`${orderId}|${paymentId}`).digest('hex')
    return safeCompare(expected, signature)
  }

  /** Test seam: makes order-payment lookups fail, as if the gateway were unreachable. */
  static lookupsFail = false

  async fetchPayment(paymentId: string): Promise<GatewayPaymentStatus | null> {
    return FakeGateway.payments.get(paymentId) ?? null
  }

  async fetchOrderPayments(gatewayOrderId: string): Promise<GatewayPaymentStatus[]> {
    if (FakeGateway.lookupsFail) throw new Error('fake gateway unreachable')
    return [...FakeGateway.payments.values()].filter((p) => p.orderId === gatewayOrderId)
  }

  /** What the browser checkout hands back after a successful payment. */
  simulateCheckout(
    gatewayOrderId: string,
    amount: number,
    status: GatewayPaymentStatus['status'] = 'captured',
  ): CheckoutResponse {
    const paymentId = `pay_fake_${randomBytes(9).toString('hex')}`
    FakeGateway.payments.set(paymentId, { paymentId, orderId: gatewayOrderId, amount, method: 'upi', status })
    const signature = createHmac('sha256', FakeGateway.keySecret).update(`${gatewayOrderId}|${paymentId}`).digest('hex')
    return { orderId: gatewayOrderId, paymentId, signature }
  }

  verifyWebhook(rawBody: string, signature: string | undefined): boolean {
    if (!signature) return false
    const expected = createHmac('sha256', this.secret).update(rawBody).digest('hex')
    return safeCompare(expected, signature)
  }

  parseWebhook(payload: unknown): ParsedWebhook | null {
    const body = payload as WebhookBody
    if (!body?.event) return null
    const entity = body.payload?.payment?.entity
    const payment =
      entity?.id && entity.order_id
        ? { paymentId: entity.id, orderId: entity.order_id, amount: entity.amount ?? 0, method: entity.method ?? 'upi' }
        : null
    const refund = parseRefundEntity(body)
    return { eventId: `${body.event}:${refund?.refundId ?? entity?.id ?? 'unknown'}`, eventType: body.event, payment, refund }
  }

  /**
   * Test seam: what refund requests return. `processed` by default;
   * `pending`, `failed` and `unknown` mimic Razorpay's other answers.
   */
  static refundOutcome: 'processed' | 'pending' | 'failed' | 'unknown' = 'processed'
  /** Every refund the fake has been asked for, oldest first. */
  static readonly refundRequests: RefundRequest[] = []

  async refundPayment(input: RefundRequest): Promise<GatewayRefundResult> {
    FakeGateway.refundRequests.push(input)
    const outcome = FakeGateway.refundOutcome
    if (outcome === 'failed') return { status: 'failed', reason: 'The fake gateway refused this refund.' }
    if (outcome === 'unknown') return { status: 'unknown', reason: 'The fake gateway did not answer.' }
    return { status: outcome, refundId: `rfnd_fake_${randomBytes(9).toString('hex')}` }
  }

  /** A signed refund webhook, as Razorpay sends for refund.processed / refund.failed. */
  simulateRefundEvent(
    event: 'refund.processed' | 'refund.failed',
    refund: { refundId: string; paymentId: string; amount: number; notes?: Record<string, string> },
  ): { body: string; signature: string } {
    const body = JSON.stringify({
      event,
      payload: {
        refund: {
          entity: {
            id: refund.refundId,
            payment_id: refund.paymentId,
            amount: refund.amount,
            notes: refund.notes ?? [],
            status: event === 'refund.processed' ? 'processed' : 'failed',
          },
        },
      },
    })
    return { body, signature: createHmac('sha256', this.secret).update(body).digest('hex') }
  }

  /** Builds a signed webhook exactly as the real gateway would send it. */
  simulatePayment(gatewayOrderId: string, amount: number): { body: string; signature: string } {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_fake_${randomBytes(9).toString('hex')}`,
            order_id: gatewayOrderId,
            amount,
            method: 'upi',
          },
        },
      },
    })
    return { body, signature: createHmac('sha256', this.secret).update(body).digest('hex') }
  }
}

let cached: PaymentGateway | null = null

export function getGateway(): PaymentGateway {
  if (cached) return cached
  if (env.PAYMENT_PROVIDER === 'razorpay') {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = env
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_WEBHOOK_SECRET) {
      // Refuse rather than silently falling back — a production deploy that
      // quietly used a fake gateway would take orders it can never collect.
      throw new Error(
        'PAYMENT_PROVIDER=razorpay but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET are not all set',
      )
    }
    cached = new RazorpayGateway(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET)
  } else {
    cached = new FakeGateway()
  }
  return cached
}

/** Test seam. */
export const __resetGateway = () => {
  cached = null
}
