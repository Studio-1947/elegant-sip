import nodemailer from 'nodemailer'
import { env } from '../env.js'

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
}

/**
 * Never throws. A failed confirmation email must not roll back a paid order —
 * it is logged and reported as undelivered so the caller can decide.
 */
export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const { html, text } = render(message)

  if (!transport) {
    console.info(`[email] SMTP_URL unset — not sending "${message.subject}" to ${message.to}`)
    return { delivered: false }
  }

  try {
    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      text,
      html,
    })
    return { delivered: true, messageId: info.messageId }
  } catch (error) {
    console.error('[email] send failed', { to: message.to, subject: message.subject, error })
    return { delivered: false }
  }
}
