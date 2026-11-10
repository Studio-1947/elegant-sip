import { asc, desc, eq } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { adminAuditEvents, users } from '../db/schema-commerce.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — audit log (read-only).
 *
 * Every successful staff change is recorded by the hook in admin.ts. The table
 * is append-only (a database trigger refuses UPDATE and DELETE), so this file
 * only reads. Registered inside admin.ts, so the admin auth hook covers it.
 * ──────────────────────────────────────────────────────────────────────────── */

const actorSchema = z.object({ id: z.string().uuid(), name: z.string(), email: z.string() })

export const adminAuditRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/audit',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Staff audit log',
        description: 'Newest first. `actors` lists everyone with at least one entry, for filtering.',
        querystring: z.object({
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).max(100_000).default(0),
          actor: z.string().uuid().optional(),
        }),
        response: {
          200: z.object({
            events: z.array(
              z.object({
                id: z.string().uuid(),
                action: z.string(),
                resource: z.string(),
                statusCode: z.number().int(),
                occurredAt: z.iso.datetime(),
                actor: actorSchema,
              }),
            ),
            hasMore: z.boolean(),
            actors: z.array(actorSchema),
          }),
          401: problemSchema,
          403: problemSchema,
        },
      },
    },
    async (request) => {
      const { limit, offset, actor } = request.query
      // One extra row says whether another page exists without a count query.
      const [rows, actors] = await Promise.all([
        db
          .select({
            id: adminAuditEvents.id,
            action: adminAuditEvents.action,
            resource: adminAuditEvents.resource,
            statusCode: adminAuditEvents.statusCode,
            occurredAt: adminAuditEvents.occurredAt,
            actorId: users.id,
            actorName: users.name,
            actorEmail: users.email,
          })
          .from(adminAuditEvents)
          .innerJoin(users, eq(adminAuditEvents.actorId, users.id))
          .where(actor ? eq(adminAuditEvents.actorId, actor) : undefined)
          .orderBy(desc(adminAuditEvents.occurredAt), desc(adminAuditEvents.id))
          .limit(limit + 1)
          .offset(offset),
        db
          .selectDistinct({ id: users.id, name: users.name, email: users.email })
          .from(adminAuditEvents)
          .innerJoin(users, eq(adminAuditEvents.actorId, users.id))
          .orderBy(asc(users.name), asc(users.email), asc(users.id))
          .limit(200),
      ])
      return {
        events: rows.slice(0, limit).map((r) => ({
          id: r.id,
          action: r.action,
          resource: r.resource,
          statusCode: r.statusCode,
          occurredAt: r.occurredAt.toISOString(),
          actor: { id: r.actorId, name: r.actorName, email: r.actorEmail },
        })),
        hasMore: rows.length > limit,
        actors,
      }
    },
  )
}
