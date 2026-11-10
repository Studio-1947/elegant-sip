import nodemailer from 'nodemailer'
import { env } from '../env.js'
import { db } from '../db/client.js'
import { emailOutbox } from '../db/schema-commerce.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Transactional email.
 *
 * Plain SMTP via nodemailer, which means it works against the Mailpit
 * container locally and against Resend / SES / anything else in production by
 * changing one connection string.
 *
 * The honesty rule reaches in here: the UI may only claim a message was sent
 * once `sendEmail` has actually resolved. When SMTP_URL is unset the transport
 * logs instead of sending and reports `delivered: false`, so callers can tell
 * the difference between "sent" and "would have sent".
 *
 * When SMTP is configured but a send fails, the rendered message is kept in
 * `email_outbox` and retried by the worker in email-outbox.ts. The caller still
 * hears `delivered: false`: "not sent yet" is the truth at that moment.
 * ──────────────────────────────────────────────────────────────────────────── */

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null

export interface EmailAction {
  label: string
  url: string
}

export interface EmailMessage {
  to: string
  subject: string
  heading: string
  /** Paragraphs. */
  body: string[]
  action?: EmailAction
  /** Rendered as a definition list — order summaries, tracking details. */
  facts?: [string, string][]
  footnote?: string
  /** Where a reply should go, e.g. the customer who used the contact form. */
  replyTo?: string
  /** Label for logs and the admin outbox, e.g. "contact". Inferred when omitted. */
  kind?: string
}

const BRAND = '#1b261b'
const ACCENT = '#4a7333'
const PAPER = '#f9faf7'
const INK = '#45523f'

/**
 * One template for every message. Table-based and inline-styled because email
 * clients remain hostile to anything else; no external images, so nothing
 * breaks when a client blocks remote content.
 */
function render(message: EmailMessage): { html: string; text: string } {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const paragraphs = message.body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font:400 15px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">${esc(p)}</p>`,
    )
    .join('')

  const facts = message.facts?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;border-collapse:collapse">${message.facts
        .map(
          ([k, v]) =>
            `<tr><td style="padding:7px 0;font:400 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${INK}">${esc(k)}</td><td align="right" style="padding:7px 0;font:600 13px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND}">${esc(v)}</td></tr>`,
        )
        .join('')}</table>`
    : ''

  const action = message.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td style="background:${BRAND};border-radius:8px"><a href="${esc(message.action.url)}" style="display:inline-block;padding:13px 26px;font:700 12px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#ffffff;text-decoration:none">${esc(message.action.label)}</a></td></tr></table>
       <p style="margin:0 0 24px;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b766a;word-break:break-all">Or paste this into your browser:<br>${esc(message.action.url)}</p>`
    : ''

  const footnote = message.footnote
    ? `<p style="margin:0;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b766a">${esc(message.footnote)}</p>`
    : ''

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${PAPER}">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:${PAPER}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid rgba(27,38,27,.10);border-radius:14px">
      <tr><td style="padding:28px 32px 0">
        <span style="font:700 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.02em;color:${BRAND};text-transform:uppercase">Elegant Sip</span>
        <span style="display:block;margin-top:6px;font:600 10px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.22em;text-transform:uppercase;color:${ACCENT}">Single-Origin Darjeeling</span>
      </td></tr>
      <tr><td style="padding:24px 32px 32px">
        <h1 style="margin:0 0 18px;font:700 24px/1.25 Georgia,'Times New Roman',serif;color:${BRAND}">${esc(message.heading)}</h1>
        ${paragraphs}${facts}${action}${footnote}
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font:400 11px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6b766a">Elegant Sip · Darjeeling, West Bengal</p>
  </td></tr>
</table></body></html>`

  const text = [
    message.heading,
    '',
    ...message.body,
    ...(message.facts?.length ? ['', ...message.facts.map(([k, v]) => `${k}: ${v}`)] : []),
    ...(message.action ? ['', `${message.action.label}: ${message.action.url}`] : []),
    ...(message.footnote ? ['', message.footnote] : []),
    '',
    'Elegant Sip · Darjeeling, West Bengal',
  ].join('\n')

  return { html, text }
}

export interface SendResult {
  delivered: boolean
  messageId?: string
  /** True when a failed send was kept in the outbox for another try. */
  queued?: boolean
}

/** A message ready for the wire, as the outbox stores it. */
export interface RenderedEmail {
  to: string
  subject: string
  html: string
  text: string
  replyTo: string | null
}

/**
 * Messages carrying a sign-in, verification or reset link. They are retried,
 * but only briefly: an old link is worth less than the customer asking again,
 * and the stored copy of it should not outlive its use.
 */
export const ONE_TIME_KIND = 'one_time_link'
export const ONE_TIME_MAX_AGE_MS = 60 * 60_000

function classify(message: EmailMessage): string {
  if (message.action && /[?&](token|code)=/.test(message.action.url)) return ONE_TIME_KIND
  if (message.kind) return message.kind
  return message.subject.startsWith('[Staff]') ? 'staff_alert' : 'general'
}

/** True when SMTP is configured, i.e. when there is anything to retry with. */
export const emailTransportConfigured = transport !== null

/** One SMTP attempt. Throws on failure; the outbox worker records why. */
export async function deliver(email: RenderedEmail): Promise<string> {
  if (!transport) throw new Error('SMTP_URL is not configured')
  const info = await transport.sendMail({
    from: env.MAIL_FROM,
    to: email.to,
    ...(email.replyTo ? { replyTo: email.replyTo } : {}),
    subject: email.subject,
    text: email.text,
    html: email.html,
  })
  return info.messageId
}

/** A short, log-safe reason. SMTP errors do not carry credentials, but are capped anyway. */
export function describeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.slice(0, 500)
}

/** First retry in a minute; see RETRY_DELAYS_MINUTES in email-outbox.ts. */
async function keepForRetry(kind: string, email: RenderedEmail, error: unknown): Promise<boolean> {
  try {
    await db.insert(emailOutbox).values({
      kind,
      ...email,
      attempts: 1,
      nextAttemptAt: new Date(Date.now() + 60_000),
      lastError: describeError(error),
    })
    return true
  } catch (storeError) {
    console.error('[email] could not keep failed message for retry', { subject: email.subject, error: storeError })
    return false
  }
}

/**
 * Never throws. A failed confirmation email must not roll back a paid order —
 * it is logged and reported as undelivered so the caller can decide.
 *
 * `retry: false` skips the outbox. Alerts about the outbox itself use it, so a
 * mail outage cannot feed on its own failure notices.
 */
export async function sendEmail(message: EmailMessage, options: { retry?: boolean } = {}): Promise<SendResult> {
  const { html, text } = render(message)

  if (message.to.toLowerCase().endsWith('.invalid')) {
    console.info(`[email] not sending "${message.subject}": recipient is a placeholder address`)
    return { delivered: false }
  }

  if (!transport) {
    console.info(`[email] SMTP_URL unset — not sending "${message.subject}" to ${message.to}`)
    return { delivered: false }
  }

  const email: RenderedEmail = { to: message.to, subject: message.subject, html, text, replyTo: message.replyTo ?? null }
  try {
    return { delivered: true, messageId: await deliver(email) }
  } catch (error) {
    console.error('[email] send failed', { to: message.to, subject: message.subject, error })
    if (options.retry === false) return { delivered: false }
    return { delivered: false, queued: await keepForRetry(classify(message), email, error) }
  }
}
