import { z } from 'zod'

/* ────────────────────────────────────────────────────────────────────────────
 * Configuration, validated at boot.
 *
 * The process must refuse to start on bad config rather than discovering it at
 * the worst moment. A missing RAZORPAY_WEBHOOK_SECRET should be a crash on
 * deploy, not a silent signature-verification failure during a real payment.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Treats `KEY=` (blank) in an env file the same as the key being absent. */
const blankAsUnset = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value), schema.optional())

/** Also docker-compose.prod.yml's fallback, so "set to this" counts as unset. */
export const DEFAULT_MAIL_FROM = 'Elegant Sip <orders@elegantsip.in>'

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
  MAIL_FROM: z.string().default(DEFAULT_MAIL_FROM),
  CONTACT_INBOX: z.string().default('elegantsipdarjeeling@gmail.com'),

  /* GST. Invoices are generated either way, but without a GSTIN the document
     cannot claim to be a tax invoice — see lib/invoice.ts. */
  SELLER_GSTIN: z.string().optional(),
  SELLER_STATE: z.string().default('West Bengal'),

  /** `disabled` is a deliberately read-only catalogue mode; it never creates orders. */
  PAYMENT_PROVIDER: z.enum(['razorpay', 'fake', 'disabled']).default('fake'),

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

  /**
   * Where product photos uploaded in the admin are written. Must be on a
   * persistent volume in production (docker-compose.prod.yml mounts one), or
   * uploads vanish when the container is rebuilt.
   */
  UPLOADS_DIR: z.string().min(1).default('./uploads'),

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
  // A shared Interakt workspace has one callback destination. Elegant Sip is that destination
  // and forwards only Aangan-namespaced status events to this internal recipient.
  AANGAN_INTERAKT_WEBHOOK_URL: blankAsUnset(z.string().url()),

  /*
   * Encrypts staff TOTP secrets at rest (lib/mfa.ts). 64 hex characters
   * (`openssl rand -hex 32`). Unset: two-step sign-in cannot be turned on, and
   * staff who already use it can sign in only with a recovery code.
   */
  MFA_ENCRYPTION_KEY: blankAsUnset(z.string().trim().regex(/^[0-9a-fA-F]{64}$/, 'must be 64 hex characters (openssl rand -hex 32)')),

  /* Phase 03+. Optional now so phases 00–02 run without payment credentials,
     but see assertPaymentsConfigured() — the code that needs them refuses to
     operate rather than half-working. */
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  /*
   * Shipping. `manual` keeps the type-in-a-tracking-number flow only; `fake`
   * exercises the courier flow locally without an account; `shiprocket` books
   * real shipments. Shiprocket needs an API user (Settings → API → Create API
   * User), not the main dashboard login.
   */
  SHIPPING_PROVIDER: z.enum(['manual', 'shiprocket', 'fake']).default('manual'),
  SHIPROCKET_API_BASE_URL: z.string().url().default('https://apiv2.shiprocket.in/v1/external'),
  SHIPROCKET_EMAIL: blankAsUnset(z.string()),
  SHIPROCKET_PASSWORD: blankAsUnset(z.string()),
  /** The pickup address nickname exactly as saved in Shiprocket (Settings → Pickup Addresses). */
  SHIPROCKET_PICKUP_LOCATION: blankAsUnset(z.string()),
  /** Pincode of that pickup address — used for courier rate lookups. */
  SHIPROCKET_PICKUP_POSTCODE: blankAsUnset(z.string().regex(/^[1-9]\d{5}$/, 'must be a 6-digit pincode')),
  /** Token entered in Shiprocket's webhook settings; sent back to us in the x-api-key header. */
  SHIPROCKET_WEBHOOK_TOKEN: blankAsUnset(z.string().min(16)),
  /** Default parcel box and packaging weight added on top of the tea itself. */
  SHIP_PACKAGE_LENGTH_CM: z.coerce.number().positive().default(20),
  SHIP_PACKAGE_BREADTH_CM: z.coerce.number().positive().default(15),
  SHIP_PACKAGE_HEIGHT_CM: z.coerce.number().positive().default(10),
  SHIP_PACKAGING_WEIGHT_GRAMS: z.coerce.number().int().min(0).default(150),
  /**
   * Refreshes courier tracking for open shipments that have been silent this
   * long — a safety net for missed webhooks. 0 turns it off.
   */
  SHIPMENT_SYNC_MINUTES: z.coerce.number().int().min(0).max(24 * 60).default(180),

  /*
   * Server watchdog (lib/watchdog.ts), production only: emails CONTACT_INBOX
   * about a nearly full disk or failed backups. OPS_STATUS_DIR is where the
   * backup containers leave their status files; unset skips the backup checks.
   */
  WATCHDOG_MINUTES: z.coerce.number().int().min(0).max(24 * 60).default(30),
  DISK_ALERT_PERCENT: z.coerce.number().min(1).max(90).default(15),
  OPS_STATUS_DIR: blankAsUnset(z.string()),

  /*
   * Meta Conversions API (lib/meta-capi.ts). The browser's Meta Pixel events
   * are also sent from this server, so ad-blockers do not hide them. Without
   * the access token nothing is sent. The pixel ID must match the storefront's
   * VITE_META_PIXEL_ID, or Meta cannot pair the two copies of each event.
   */
  META_PIXEL_ID: z.string().trim().regex(/^\d*$/, 'must be the numeric pixel (dataset) ID').default('1702510334659568'),
  META_CAPI_ACCESS_TOKEN: blankAsUnset(z.string().trim().min(20)),
  /** From Events Manager → Test events. Set only while testing; such events never count. */
  META_CAPI_TEST_EVENT_CODE: blankAsUnset(z.string().trim().max(64)),
  META_GRAPH_API_VERSION: z.string().trim().regex(/^v\d+\.\d+$/, 'like v24.0').default('v24.0'),
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
  if (value.SHIPPING_PROVIDER === 'shiprocket') {
    const missing = (
      ['SHIPROCKET_EMAIL', 'SHIPROCKET_PASSWORD', 'SHIPROCKET_PICKUP_LOCATION', 'SHIPROCKET_PICKUP_POSTCODE'] as const
    ).filter((key) => !value[key])
    if (missing.length > 0) {
      console.error(`Invalid environment configuration:\n  ${missing.join(', ')}: required when SHIPPING_PROVIDER=shiprocket\n`)
      process.exit(1)
    }
  }
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
    if (!['razorpay', 'disabled'].includes(value.PAYMENT_PROVIDER)) {
      console.error('Invalid environment configuration:\n  PAYMENT_PROVIDER: production allows razorpay or disabled\n')
      process.exit(1)
    }
    // The fake courier invents AWBs; real orders would be "shipped" with nothing booked.
    if (value.SHIPPING_PROVIDER === 'fake') {
      console.error('Invalid environment configuration:\n  SHIPPING_PROVIDER: production allows shiprocket or manual\n')
      process.exit(1)
    }
    if (value.PAYMENT_PROVIDER === 'razorpay') {
      const missing = (['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'] as const).filter(
        (key) => !value[key],
      )
      if (missing.length > 0) {
        console.error(`Invalid environment configuration:\n  ${missing.join(', ')}: required for Razorpay in production\n`)
        process.exit(1)
      }
    }
  }
  return value
}

export const env = load()

/**
 * Email problems worth shouting about at boot but not worth refusing to boot
 * over: a shop that cannot start is worse than one whose receipts are logged
 * instead of sent. `rawMailFrom` is the unparsed variable, before the default.
 */
export function emailConfigIssues(
  config: Pick<Env, 'NODE_ENV' | 'SMTP_URL' | 'PAYMENT_PROVIDER'>,
  rawMailFrom: string | undefined,
): { level: 'error' | 'warn'; message: string }[] {
  if (config.NODE_ENV !== 'production') return []
  const issues: { level: 'error' | 'warn'; message: string }[] = []
  if (!config.SMTP_URL?.trim() && config.PAYMENT_PROVIDER === 'razorpay') {
    issues.push({
      level: 'error',
      message:
        'EMAIL NOT CONFIGURED: SMTP_URL is unset while taking real payments. Order confirmations, password resets and sign-up links are logged, not sent.',
    })
  }
  if (!rawMailFrom?.trim() || rawMailFrom.trim() === DEFAULT_MAIL_FROM) {
    issues.push({
      level: 'warn',
      message: `MAIL_FROM is unset, so mail goes out as "${DEFAULT_MAIL_FROM}". Unless the SMTP provider is authorised to send for that domain (SPF/DKIM), receiving servers may reject it under DMARC.`,
    })
  }
  return issues
}

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
  env.PAYMENT_PROVIDER === 'fake' ||
    (env.PAYMENT_PROVIDER === 'razorpay' && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_WEBHOOK_SECRET),
)
