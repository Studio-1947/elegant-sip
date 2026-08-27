import { z } from 'zod'

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration, validated at boot.
 *
 * The process must refuse to start on bad config rather than discovering it at
 * the worst moment. A missing RAZORPAY_WEBHOOK_SECRET should be a crash on
 * deploy, not a silent signature-verification failure during a real payment.
 * ──────────────────────────────────────────────────────────────────────────── */

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['silent', 'fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  /* Email. Without SMTP_URL the transport logs instead of sending and reports
     delivered:false — so the UI can never claim a message was sent. */
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Elegant Sip <orders@elegantsip.com>'),
  CONTACT_INBOX: z.string().default('elegantsipdarjeeling@gmail.com'),

  /* GST. Invoices are generated either way, but without a GSTIN the document
     cannot claim to be a tax invoice — see lib/invoice.ts. */
  SELLER_GSTIN: z.string().optional(),
  SELLER_STATE: z.string().default('West Bengal'),

  /** Which payment gateway to use. 'fake' makes checkout testable without credentials. */
  PAYMENT_PROVIDER: z.enum(['razorpay', 'fake']).default('fake'),

  /** Origins allowed to call this API with credentials. Comma-separated. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  /** Public base URL of the storefront, used in emails and absolute links. */
  SITE_URL: z.string().url().default('https://elegantsip.com'),

  /* Phase 03+. Optional now so phases 00–02 run without payment credentials,
     but see assertPaymentsConfigured() — the code that needs them refuses to
     operate rather than half-working. */
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

function load(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    // Not a thrown Error: a stack trace here is noise, the list is the message.
    console.error(`Invalid environment configuration:\n${issues}\n`)
    process.exit(1)
  }
  return parsed.data
}

export const env = load()

export const isProduction = env.NODE_ENV === 'production'

export interface PaymentConfig {
  keyId: string
  keySecret: string
  webhookSecret: string
}

/**
 * Gate for payment code paths. Anything that talks to Razorpay calls this
 * first, so a misconfigured deploy fails loudly and immediately rather than
 * creating orders it can never collect on.
 */
export function requirePaymentConfig(): PaymentConfig {
  const missing = (['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const).filter(
    (k) => !env[k],
  )
  if (missing.length > 0) {
    throw new Error(`Payments are not configured — missing ${missing.join(', ')}`)
  }
  return {
    keyId: env.RAZORPAY_KEY_ID!,
    keySecret: env.RAZORPAY_KEY_SECRET!,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET!,
  }
}

/** Whether payment endpoints should be mounted at all. */
export const paymentsEnabled = Boolean(
  env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET,
)
