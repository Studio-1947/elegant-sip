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
  MAIL_FROM: z.string().default('Elegant Sip <orders@elegantsip.in>'),
  CONTACT_INBOX: z.string().default('elegantsipdarjeeling@gmail.com'),

  /* GST. Invoices are generated either way, but without a GSTIN the document
     cannot claim to be a tax invoice — see lib/invoice.ts. */
  SELLER_GSTIN: z.string().optional(),
  SELLER_STATE: z.string().default('West Bengal'),

  /** Which payment gateway to use. 'fake' is allowed only outside production. */
  PAYMENT_PROVIDER: z.enum(['razorpay', 'fake']).default('fake'),

  /** Swagger is useful locally but should not disclose operations by default in production. */
  API_DOCS_ENABLED: z
    .string()
    .optional()
    .transform((value) => value === undefined || ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())),

  /** Origins allowed to call this API with credentials. Comma-separated. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  /** Public base URL of the storefront, used in emails and absolute links. */
  SITE_URL: z.string().url().default('https://elegantsip.in'),

  /*
   * Apply migrations and load the catalogue during boot rather than as a
   * separate step before it.
   *
   * Off by default and it should stay off wherever the host can run a
   * pre-deploy command: with more than one instance, several servers would
   * start together and race each other through the migration table. Turn it on
   * only on single-instance hosts whose free tier offers no pre-deploy step —
   * without it, the very first deploy there comes up against an empty database.
   */
  MIGRATE_ON_START: z
    .string()
    .default('false')
    .transform((value) => ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())),

  /** Pending orders beyond this window are cancelled and their stock returned. */
  PENDING_PAYMENT_TTL_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  ORDER_EXPIRY_SWEEP_SECONDS: z.coerce.number().int().min(15).max(60 * 60).default(60),

  /** WhatsApp OTP stays disabled until Interakt is fully configured. */
  AUTH_OTP_PROVIDER: z.enum(['disabled', 'interakt']).default('disabled'),
  INTERAKT_API_KEY: z.string().optional(),
  INTERAKT_API_BASE_URL: z.string().url().default('https://api.interakt.ai/v1/public'),
  INTERAKT_OTP_TEMPLATE: z.string().trim().min(1).default('elegant_sip_otp'),
  INTERAKT_OTP_TEMPLATE_LANGUAGE: z.string().trim().min(2).max(20).default('en'),
  INTERAKT_WEBHOOK_SECRET: z.string().optional(),

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
  const value = parsed.data
  if (value.AUTH_OTP_PROVIDER === 'interakt' && !value.INTERAKT_API_KEY) {
    console.error('Invalid environment configuration:\n  INTERAKT_API_KEY: required when AUTH_OTP_PROVIDER=interakt\n')
    process.exit(1)
  }
  // Cookie-policy tests intentionally import this module with NODE_ENV set to
  // production to simulate deployed URLs. Vitest itself is never a deploy.
  if (value.NODE_ENV === 'production' && !process.env.VITEST) {
    // Docker Compose passes this explicitly; retain the safe default for any
    // other production launch path as well.
    if (process.env.API_DOCS_ENABLED === undefined) value.API_DOCS_ENABLED = false
    if (value.PAYMENT_PROVIDER !== 'razorpay') {
      console.error('Invalid environment configuration:\n  PAYMENT_PROVIDER: production requires razorpay\n')
      process.exit(1)
    }
    const missing = (['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const).filter(
      (key) => !value[key],
    )
    if (missing.length > 0) {
      console.error(`Invalid environment configuration:\n  ${missing.join(', ')}: required for Razorpay in production\n`)
      process.exit(1)
    }
    if (!value.SMTP_URL) {
      console.error('Invalid environment configuration:\n  SMTP_URL: production requires transactional email\n')
      process.exit(1)
    }
  }
  return value
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
