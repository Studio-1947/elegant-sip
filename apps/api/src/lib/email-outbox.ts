import { and, asc, eq, inArray, lt, lte } from 'drizzle-orm'
import type { FastifyBaseLogger } from 'fastify'
import { db } from '../db/client.js'
import { emailOutbox } from '../db/schema-commerce.js'
import { env } from '../env.js'
import { ApiError } from './problem.js'
import {
  ONE_TIME_KIND,
  ONE_TIME_MAX_AGE_MS,
  deliver,
  describeError,
  sendEmail,
  type RenderedEmail,
} from './email.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Email retry.
 *
 * sendEmail keeps a message here when SMTP refused it. This worker tries again
 * on a widening schedule, then gives up, marks it `failed` and tells staff.
 *
 * Rows are claimed with FOR UPDATE SKIP LOCKED and leased by pushing
 * next_attempt_at forward, so two API processes never send the same message
 * and a process that dies mid-send only delays it by the lease.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Waits after attempt 1, 2, … — five retries after the first failure, so six attempts in all. */
export const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240] as const
const LEASE_MS = 10 * 60_000
const BATCH = 20

type Row = typeof emailOutbox.$inferSelect
type Send = (email: RenderedEmail) => Promise<unknown>
type Alert = (failed: Pick<Row, 'kind' | 'to' | 'subject' | 'lastError'>[]) => Promise<void>

const isOneTime = (row: Pick<Row, 'kind'>) => row.kind === ONE_TIME_KIND
const tooOld = (row: Pick<Row, 'kind' | 'createdAt'>, at: Date) =>
  isOneTime(row) && at.getTime() - row.createdAt.getTime() > ONE_TIME_MAX_AGE_MS

/* Sent mail and dead one-time links keep their metadata for the admin list,
   not their contents. */
const NO_BODY = { html: '', text: '' }

/**
 * Sent with `retry: false`: if mail is down this alert fails too, and it must
 * not become another outbox row that fails and alerts in turn.
 */
const alertStaffDirect: Alert = async (failed) => {
  if (!env.CONTACT_INBOX || failed.length === 0) return
  const subject = failed.length === 1 ? 'An email could not be delivered' : `${failed.length} emails could not be delivered`
  await sendEmail(
    {
      kind: 'staff_alert',
      to: env.CONTACT_INBOX,
      subject: `[Staff] ${subject}`,
      heading: subject,
      body: [
        'These messages failed every retry and will not be tried again automatically. Check the mail provider, then use "Retry now" on the admin page, or contact the customer another way.',
      ],
      facts: failed.map((row) => [`${row.kind} → ${row.to}`, `${row.subject}${row.lastError ? ` (${row.lastError.slice(0, 120)})` : ''}`]),
    },
    { retry: false },
  )
}

function toRendered(row: Row): RenderedEmail {
  return { to: row.to, subject: row.subject, html: row.html, text: row.text, replyTo: row.replyTo }
}

/** What happens to a row after one more failed attempt. */
function afterFailure(row: Row, attempts: number, error: unknown, at: Date) {
  const lastError = describeError(error)
  const delay = RETRY_DELAYS_MINUTES[attempts - 1]
  const next = delay === undefined ? null : new Date(at.getTime() + delay * 60_000)
  // A one-time link whose next try would land past its useful life ends now.
  if (next === null || (isOneTime(row) && next.getTime() - row.createdAt.getTime() > ONE_TIME_MAX_AGE_MS)) {
    return { status: 'failed' as const, attempts, lastError, ...(isOneTime(row) ? NO_BODY : {}) }
  }
  return { status: 'pending' as const, attempts, lastError, nextAttemptAt: next }
}

export interface OutboxSweep {
  sent: number
  retrying: number
  failed: number
}

/**
 * One pass over due messages. Never throws for a single message; a database
 * error propagates to the caller's interval, which logs it and tries later.
 */
export async function processEmailOutbox(
  options: { send?: Send; alert?: Alert; now?: Date; log?: FastifyBaseLogger } = {},
): Promise<OutboxSweep> {
  const { send = deliver, alert = alertStaffDirect, now = new Date(), log } = options
  const result: OutboxSweep = { sent: 0, retrying: 0, failed: 0 }

  const due = db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, 'pending'), lte(emailOutbox.nextAttemptAt, now)))
    .orderBy(asc(emailOutbox.nextAttemptAt))
    .limit(BATCH)
    .for('update', { skipLocked: true })
  const claimed = await db
    .update(emailOutbox)
    .set({ nextAttemptAt: new Date(now.getTime() + LEASE_MS) })
    .where(inArray(emailOutbox.id, due))
    .returning()

  const newlyFailed: Row[] = []
  for (const row of claimed) {
    if (tooOld(row, now)) {
      const lastError = 'Not retried: a one-time link older than an hour is better requested again.'
      await db.update(emailOutbox).set({ status: 'failed', lastError, ...NO_BODY }).where(eq(emailOutbox.id, row.id))
      newlyFailed.push({ ...row, lastError })
      continue
    }
    const attempts = row.attempts + 1
    try {
      await send(toRendered(row))
      await db.update(emailOutbox).set({ status: 'sent', attempts, sentAt: new Date(), ...NO_BODY }).where(eq(emailOutbox.id, row.id))
      result.sent++
    } catch (error) {
      const next = afterFailure(row, attempts, error, now)
      await db.update(emailOutbox).set(next).where(eq(emailOutbox.id, row.id))
      if (next.status === 'failed') newlyFailed.push({ ...row, lastError: next.lastError })
      else result.retrying++
      log?.warn({ kind: row.kind, attempts, err: error }, 'email retry failed')
    }
  }

  result.failed = newlyFailed.length
  if (newlyFailed.length > 0) {
    try {
      await alert(newlyFailed)
    } catch (error) {
      log?.error({ err: error }, 'outbox failure alert could not be sent')
    }
  }

  // Sent rows have no body left; a month of them is plenty for "did it go?".
  await db.delete(emailOutbox).where(and(eq(emailOutbox.status, 'sent'), lt(emailOutbox.sentAt, new Date(now.getTime() - 30 * 86_400_000))))
  return result
}

/**
 * Staff pressed "Retry now": one attempt immediately, whatever the schedule
 * says. A failure leaves the row where it was (pending keeps its schedule,
 * failed stays failed) and never alerts — staff are already looking.
 */
export async function retryOutboxMessage(id: string, send: Send = deliver): Promise<Row> {
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(emailOutbox).where(eq(emailOutbox.id, id)).for('update', { skipLocked: true })
    if (!row) {
      const exists = await tx.select({ id: emailOutbox.id }).from(emailOutbox).where(eq(emailOutbox.id, id))
      if (exists.length === 0) throw ApiError.notFound('That message')
      throw new ApiError(409, 'busy', 'Already retrying', 'That message is being retried right now. Refresh in a minute.')
    }
    if (row.status === 'sent') throw new ApiError(409, 'already_sent', 'Already sent', 'That message has already been delivered.')
    if (isOneTime(row) && (row.html === '' || tooOld(row, new Date()))) {
      throw new ApiError(409, 'expired', 'Link expired', 'This message held a one-time link that has expired. Ask the customer to request a new one.')
    }

    const attempts = row.attempts + 1
    try {
      await send(toRendered(row))
      const [updated] = await tx
        .update(emailOutbox)
        .set({ status: 'sent', attempts, sentAt: new Date(), ...NO_BODY })
        .where(eq(emailOutbox.id, id))
        .returning()
      return updated
    } catch (error) {
      const [updated] = await tx
        .update(emailOutbox)
        .set({ attempts, lastError: describeError(error) })
        .where(eq(emailOutbox.id, id))
        .returning()
      return updated
    }
  })
}

/** Registered from index.ts. Only meaningful with SMTP configured. */
export function startEmailOutboxWorker(log: FastifyBaseLogger, everySeconds = 60): NodeJS.Timeout {
  // A slow SMTP server must not stack sweeps on top of each other.
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const sweep = await processEmailOutbox({ log })
      if (sweep.sent + sweep.failed > 0) log.info(sweep, 'email outbox sweep')
    } catch (err) {
      log.error({ err }, 'email outbox sweep failed')
    } finally {
      running = false
    }
  }
  return setInterval(() => void tick(), everySeconds * 1_000)
}
