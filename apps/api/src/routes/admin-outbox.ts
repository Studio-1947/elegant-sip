import { desc, inArray } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { emailOutbox } from '../db/schema-commerce.js'
import { retryOutboxMessage } from '../lib/email-outbox.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — email outbox.
 *
 * Messages SMTP refused, still being retried or given up on. Bodies are never
 * returned: they can hold customer details and one-time links. Registered
 * inside admin.ts, so the admin auth hook covers it.
 * ──────────────────────────────────────────────────────────────────────────── */

const outboxItemSchema = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  to: z.string(),
  subject: z.string(),
  status: z.enum(['pending', 'sent', 'failed']),
  attempts: z.number().int(),
  lastError: z.string().nullable(),
  nextAttemptAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  sentAt: z.iso.datetime().nullable(),
})

function toItem(row: typeof emailOutbox.$inferSelect) {
  return {
    id: row.id,
    kind: row.kind,
    to: row.to,
    subject: row.subject,
    status: row.status,
    attempts: row.attempts,
    lastError: row.lastError,
    nextAttemptAt: row.nextAttemptAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
  }
}

export const adminOutboxRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/email-outbox',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Emails waiting for a retry, or given up on',
        description: 'Newest first. Pending messages are retried automatically; failed ones only by "Retry now". No message bodies.',
        querystring: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }),
        response: { 200: z.object({ messages: z.array(outboxItemSchema) }), 401: problemSchema, 403: problemSchema },
      },
    },
    async (request) => {
      const rows = await db
        .select()
        .from(emailOutbox)
        .where(inArray(emailOutbox.status, ['pending', 'failed']))
        .orderBy(desc(emailOutbox.createdAt), desc(emailOutbox.id))
        .limit(request.query.limit)
      return { messages: rows.map(toItem) }
    },
  )

  app.post(
    '/admin/email-outbox/:id/retry',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Try sending a queued email now',
        description: 'One attempt, immediately. `message.status` is `sent` only when the mail server accepted it.',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: z.object({ message: outboxItemSchema }), 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => ({ message: toItem(await retryOutboxMessage(request.params.id)) }),
  )
}
