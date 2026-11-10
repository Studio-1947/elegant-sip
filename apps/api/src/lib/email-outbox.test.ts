import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, like } from 'drizzle-orm'

/* SMTP "configured" but every send goes through this mock, so a failure can be
   staged without a mail server. Set before email.ts reads the environment. */
const sendMail = vi.hoisted(() => {
  process.env.SMTP_URL = 'smtp://mock.invalid:25'
  process.env.CONTACT_INBOX = 'shop-inbox@example.test'
  return vi.fn(async (_mail: { to: string; subject: string }) => ({ messageId: '<ok@test>' }))
})
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }))

const { db, sql } = await import('../db/client.js')
const { emailOutbox } = await import('../db/schema-commerce.js')
const { sendEmail, ONE_TIME_KIND } = await import('./email.js')
const { processEmailOutbox, retryOutboxMessage, RETRY_DELAYS_MINUTES } = await import('./email-outbox.js')

const TAG = `outbox-${Date.now()}`
const address = (label: string) => `${TAG}.${label}@example.test`
let available = true

const minutes = (n: number) => n * 60_000
const rowFor = async (to: string) => (await db.select().from(emailOutbox).where(eq(emailOutbox.to, to)))[0]
const failing = vi.fn(async () => {
  throw new Error('421 try again later')
})

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch {
    available = false
  }
})

beforeEach(() => {
  sendMail.mockReset()
  sendMail.mockResolvedValue({ messageId: '<ok@test>' })
  failing.mockClear()
})

afterAll(async () => {
  if (available) {
    await db.delete(emailOutbox).where(like(emailOutbox.to, `${TAG}.%`))
    await db.delete(emailOutbox).where(like(emailOutbox.subject, `%${TAG}%`))
  }
  await sql.end({ timeout: 5 }).catch(() => {})
})

describe('sendEmail with SMTP configured', () => {
  it('delivers without touching the outbox when the server accepts', async () => {
    if (!available) return
    const to = address('ok')
    const result = await sendEmail({ to, subject: `Hello ${TAG}`, heading: 'Hi', body: ['Body'] })
    expect(result).toEqual({ delivered: true, messageId: '<ok@test>' })
    expect(await rowFor(to)).toBeUndefined()
  })

  it('keeps a refused message for retry and still reports it undelivered', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const to = address('refused')
    const result = await sendEmail({ kind: 'order_confirmation', to, subject: `Order ${TAG}`, heading: 'Thanks', body: ['Paid'], replyTo: 'r@example.test' })
    expect(result).toEqual({ delivered: false, queued: true })
    const row = await rowFor(to)
    expect(row).toMatchObject({ kind: 'order_confirmation', status: 'pending', attempts: 1, lastError: 'ECONNREFUSED', replyTo: 'r@example.test' })
    expect(row.html).toContain('Paid')
    expect(row.nextAttemptAt.getTime() - row.createdAt.getTime()).toBeGreaterThan(minutes(0.5))
  })

  it('classifies a message with a token link as one-time', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('reset')
    await sendEmail({ to, subject: `Reset ${TAG}`, heading: 'Reset', body: ['x'], action: { label: 'Reset', url: 'https://x.test/reset-password?token=abc' } })
    expect((await rowFor(to)).kind).toBe(ONE_TIME_KIND)
  })

  it('does not queue when asked not to (alerts about the outbox itself)', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('noretry')
    expect(await sendEmail({ to, subject: `Alert ${TAG}`, heading: 'x', body: ['x'] }, { retry: false })).toEqual({ delivered: false })
    expect(await rowFor(to)).toBeUndefined()
  })
})

describe('processEmailOutbox', () => {
  it('backs off 1, 5, 15, 60, 240 minutes, then fails and alerts exactly once', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('backoff')
    await sendEmail({ to, subject: `Backoff ${TAG}`, heading: 'x', body: ['x'] })
    const alert = vi.fn(async (_failed: { to: string; kind: string }[]) => {})

    let row = await rowFor(to)
    for (const [i, delay] of RETRY_DELAYS_MINUTES.entries()) {
      // Not due a moment before the scheduled time…
      const early = new Date(row.nextAttemptAt.getTime() - 1_000)
      await processEmailOutbox({ send: failing, alert, now: early })
      expect((await rowFor(to)).attempts).toBe(row.attempts)
      // …due at it.
      const at = row.nextAttemptAt
      await processEmailOutbox({ send: failing, alert, now: at })
      row = await rowFor(to)
      expect(row.attempts).toBe(i + 2)
      if (i < RETRY_DELAYS_MINUTES.length - 1) {
        expect(row.status).toBe('pending')
        expect(row.nextAttemptAt.getTime() - at.getTime()).toBe(minutes(RETRY_DELAYS_MINUTES[i + 1]))
      } else {
        expect(row.status).toBe('failed')
      }
      expect(delay).toBeGreaterThan(0)
    }
    expect(row.lastError).toBe('421 try again later')
    // Other test rows may fail in the same sweeps; count only alerts naming this one.
    const alertsAboutThis = () => alert.mock.calls.filter(([failed]) => failed.some((item) => item.to === to))
    expect(alertsAboutThis()).toHaveLength(1)
    expect(alertsAboutThis()[0][0]).toContainEqual(expect.objectContaining({ to, kind: 'general' }))

    // A failed message is never picked up again by the worker.
    await processEmailOutbox({ send: failing, alert, now: new Date(Date.now() + minutes(10_000)) })
    expect(alertsAboutThis()).toHaveLength(1)
    expect((await rowFor(to)).attempts).toBe(RETRY_DELAYS_MINUTES.length + 1)
  })

  it('marks a delivered retry sent and drops its body', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('recovers')
    await sendEmail({ to, subject: `Recovers ${TAG}`, heading: 'x', body: ['secret-ish body'] })
    const send = vi.fn(async () => '<id>')
    const sweep = await processEmailOutbox({ send, now: (await rowFor(to)).nextAttemptAt })
    expect(sweep.sent).toBeGreaterThanOrEqual(1)
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to, subject: `Recovers ${TAG}` }))
    const row = await rowFor(to)
    expect(row).toMatchObject({ status: 'sent', attempts: 2, html: '', text: '' })
    expect(row.sentAt).not.toBeNull()
  })

  it('gives up on one-time links after an hour without sending them', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('stale-link')
    await sendEmail({ to, subject: `Verify ${TAG}`, heading: 'x', body: ['x'], action: { label: 'Go', url: 'https://x.test/verify-email?token=t' } })
    const created = (await rowFor(to)).createdAt
    const send = vi.fn(async () => '<id>')
    const alert = vi.fn(async () => {})
    await processEmailOutbox({ send, alert, now: new Date(created.getTime() + minutes(61)) })
    expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ to }))
    expect(await rowFor(to)).toMatchObject({ status: 'failed', html: '', text: '' })
  })

  it('never lets two sweeps send the same message', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('race')
    await sendEmail({ to, subject: `Race ${TAG}`, heading: 'x', body: ['x'] })
    const now = (await rowFor(to)).nextAttemptAt
    const send = vi.fn(async (_email: { to: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 50))
      return '<id>'
    })
    await Promise.all([processEmailOutbox({ send, now }), processEmailOutbox({ send, now })])
    expect(send.mock.calls.filter(([email]) => email.to === to)).toHaveLength(1)
  })

  it('does not feed its own failure alert back into the outbox', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('loop')
    await sendEmail({ to, subject: `Loop ${TAG}`, heading: 'x', body: ['x'] })
    await db.update(emailOutbox).set({ attempts: RETRY_DELAYS_MINUTES.length }).where(eq(emailOutbox.to, to))
    // Mail is down for everything, including the default staff alert.
    sendMail.mockRejectedValue(new Error('still down'))
    await processEmailOutbox({ send: failing, now: (await rowFor(to)).nextAttemptAt })
    expect((await rowFor(to)).status).toBe('failed')
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'shop-inbox@example.test', subject: expect.stringContaining('could not be delivered') }))
    expect(await rowFor('shop-inbox@example.test')).toBeUndefined()
  })
})

describe('retryOutboxMessage', () => {
  it('sends a failed message on demand, and reports a refusal without changing its status', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('manual')
    await sendEmail({ to, subject: `Manual ${TAG}`, heading: 'x', body: ['x'] })
    const { id } = await rowFor(to)
    await db.update(emailOutbox).set({ status: 'failed' }).where(eq(emailOutbox.id, id))

    const refused = await retryOutboxMessage(id, failing)
    expect(refused).toMatchObject({ status: 'failed', attempts: 2, lastError: '421 try again later' })

    const sent = await retryOutboxMessage(id, async () => '<id>')
    expect(sent).toMatchObject({ status: 'sent', attempts: 3, html: '' })
    await expect(retryOutboxMessage(id, async () => '<id>')).rejects.toMatchObject({ status: 409 })
  })

  it('refuses to resend an expired one-time link', async () => {
    if (!available) return
    sendMail.mockRejectedValueOnce(new Error('down'))
    const to = address('manual-link')
    await sendEmail({ to, subject: `Link ${TAG}`, heading: 'x', body: ['x'], action: { label: 'Go', url: 'https://x.test/r?token=t' } })
    const { id } = await rowFor(to)
    await db.update(emailOutbox).set({ createdAt: new Date(Date.now() - minutes(90)) }).where(eq(emailOutbox.id, id))
    await expect(retryOutboxMessage(id, async () => '<id>')).rejects.toMatchObject({ status: 409, type: 'expired' })
  })
})
