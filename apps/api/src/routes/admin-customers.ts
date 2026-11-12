import { and, count, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { paiseSchema, problemSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { contactMessages, newsletterSubscribers, orders, savedAddresses, users } from '../db/schema-commerce.js'
import { ApiError } from '../lib/problem.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — people: customer accounts and their orders, staff access, the
 * contact-form inbox and newsletter sign-ups.
 *
 * Registered inside admin.ts, so the admin role check and audit log cover it.
 * Password hashes, MFA secrets and recovery codes are never returned.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Orders that count as a sale (money taken and not cancelled before payment). */
const SOLD = ['paid', 'packed', 'shipped', 'delivered'] as const

const likeTerm = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

const customerRow = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['customer', 'admin']),
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  createdAt: z.iso.datetime(),
  orderCount: z.number().int(),
  totalSpent: paiseSchema,
  lastOrderAt: z.iso.datetime().nullable(),
})

/** Order count, money spent and last order per account. */
async function orderStats(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, { orderCount: number; totalSpent: number; lastOrderAt: Date | null }>()
  const rows = await db
    .select({
      userId: orders.userId,
      orderCount: sql<number>`count(*) filter (where ${inArray(orders.status, [...SOLD])})::int`,
      totalSpent: sql<number>`coalesce(sum(${orders.total}) filter (where ${inArray(orders.status, [...SOLD])}), 0)::int`,
      lastOrderAt: sql<Date | null>`max(${orders.placedAt})`,
    })
    .from(orders)
    .where(inArray(orders.userId, userIds))
    .groupBy(orders.userId)
  return new Map(rows.map((r) => [r.userId!, { orderCount: r.orderCount, totalSpent: r.totalSpent, lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null }]))
}

export const adminCustomerRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/customers',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Customer accounts',
        description: 'Newest first. Guest orders have no account; find them by email in the order search.',
        querystring: pageSchema.extend({
          q: z.string().trim().max(120).optional().describe('Name, email or phone'),
          role: z.enum(['customer', 'admin']).optional(),
        }),
        response: { 200: z.object({ customers: z.array(customerRow), total: z.number().int() }) },
      },
    },
    async (request) => {
      const { q, role, limit, offset } = request.query
      const where: SQL[] = []
      if (role) where.push(eq(users.role, role))
      if (q) where.push(or(ilike(users.name, likeTerm(q)), ilike(users.email, likeTerm(q)), ilike(users.phone, likeTerm(q)))!)
      const filter = where.length ? and(...where) : undefined
      const [rows, [{ total }]] = await Promise.all([
        db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
            role: users.role,
            emailVerifiedAt: users.emailVerifiedAt,
            mfaEnabledAt: users.mfaEnabledAt,
            createdAt: users.createdAt,
          })
          .from(users)
          .where(filter)
          .orderBy(desc(users.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ total: count() }).from(users).where(filter),
      ])
      const stats = await orderStats(rows.map((r) => r.id))
      return {
        total,
        customers: rows.map((r) => {
          const s = stats.get(r.id)
          return {
            id: r.id,
            name: r.name,
            email: r.email,
            phone: r.phone,
            role: r.role,
            emailVerified: r.emailVerifiedAt !== null,
            mfaEnabled: r.mfaEnabledAt !== null,
            createdAt: r.createdAt.toISOString(),
            orderCount: s?.orderCount ?? 0,
            totalSpent: s?.totalSpent ?? 0,
            lastOrderAt: s?.lastOrderAt?.toISOString() ?? null,
          }
        }),
      }
    },
  )

  app.get(
    '/admin/customers/:id',
    {
      schema: {
        tags: ['Admin'],
        summary: 'One customer: account, saved addresses and every order',
        params: z.object({ id: z.string().uuid() }),
        response: {
          200: customerRow.extend({
            addresses: z.array(z.object({ label: z.string(), name: z.string(), line1: z.string(), city: z.string(), postalCode: z.string(), state: z.string().nullable(), phone: z.string().nullable() })),
            orders: z.array(z.object({ number: z.string(), status: z.string(), placedAt: z.iso.datetime(), total: paiseSchema })),
          }),
          404: problemSchema,
        },
      },
    },
    async (request) => {
      const user = await db.query.users.findFirst({ where: eq(users.id, request.params.id) })
      if (!user) throw ApiError.notFound('That customer')
      const [addresses, history, stats] = await Promise.all([
        db.select().from(savedAddresses).where(eq(savedAddresses.userId, user.id)),
        // Their account orders, plus any guest orders placed with the same email.
        db
          .select({ number: orders.number, status: orders.status, placedAt: orders.placedAt, total: orders.total })
          .from(orders)
          .where(or(eq(orders.userId, user.id), and(isNull(orders.userId), eq(orders.email, user.email))))
          .orderBy(desc(orders.placedAt))
          .limit(200),
        orderStats([user.id]),
      ])
      const s = stats.get(user.id)
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerifiedAt !== null,
        mfaEnabled: user.mfaEnabledAt !== null,
        createdAt: user.createdAt.toISOString(),
        orderCount: s?.orderCount ?? 0,
        totalSpent: s?.totalSpent ?? 0,
        lastOrderAt: s?.lastOrderAt?.toISOString() ?? null,
        addresses: addresses.map((a) => ({ label: a.label, name: a.name, line1: a.line1, city: a.city, postalCode: a.postalCode, state: a.state, phone: a.phone })),
        orders: history.map((o) => ({ ...o, placedAt: o.placedAt.toISOString() })),
      }
    },
  )

  app.patch(
    '/admin/customers/:id/role',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Give or take away staff access',
        description:
          'Staff (`admin`) can use the whole staff page. You cannot change your own access, and the last member of staff cannot be removed. Takes effect on their next request.',
        params: z.object({ id: z.string().uuid() }),
        body: z.object({ role: z.enum(['customer', 'admin']) }),
        response: { 200: z.object({ id: z.string().uuid(), role: z.enum(['customer', 'admin']) }), 404: problemSchema, 409: problemSchema },
      },
    },
    async (request) => {
      if (request.params.id === request.session?.userId) {
        throw ApiError.conflict('own_role', 'You cannot change your own access. Ask another member of staff.')
      }
      const role = request.body.role
      return db.transaction(async (tx) => {
        // Serialise role changes so two staff demoting each other cannot leave nobody.
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('admin_role_change'))`)
        const [user] = await tx.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, request.params.id)).for('update')
        if (!user) throw ApiError.notFound('That customer')
        if (user.role === 'admin' && role === 'customer') {
          const [{ admins }] = await tx.select({ admins: count() }).from(users).where(eq(users.role, 'admin'))
          if (admins <= 1) throw ApiError.conflict('last_admin', 'This is the last staff account. Add another before removing it.')
        }
        await tx.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, user.id))
        return { id: user.id, role }
      })
    },
  )

  app.get(
    '/admin/contact-messages',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Contact-form messages',
        description: 'Newest first. Each was also emailed to the shop inbox; reply from there.',
        querystring: pageSchema.extend({ q: z.string().trim().max(120).optional().describe('Reference, name, email or subject') }),
        response: {
          200: z.object({
            messages: z.array(
              z.object({ id: z.string().uuid(), reference: z.string(), name: z.string(), email: z.string(), subject: z.string(), message: z.string(), createdAt: z.iso.datetime(), hasAccount: z.boolean() }),
            ),
            total: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const { q, limit, offset } = request.query
      const filter = q
        ? or(
            ilike(contactMessages.reference, likeTerm(q)),
            ilike(contactMessages.name, likeTerm(q)),
            ilike(contactMessages.email, likeTerm(q)),
            ilike(contactMessages.subject, likeTerm(q)),
          )
        : undefined
      const [rows, [{ total }]] = await Promise.all([
        db.select().from(contactMessages).where(filter).orderBy(desc(contactMessages.createdAt)).limit(limit).offset(offset),
        db.select({ total: count() }).from(contactMessages).where(filter),
      ])
      return {
        total,
        messages: rows.map((m) => ({
          id: m.id,
          reference: m.reference,
          name: m.name,
          email: m.email,
          subject: m.subject,
          message: m.message,
          createdAt: m.createdAt.toISOString(),
          hasAccount: m.userId !== null,
        })),
      }
    },
  )

  app.get(
    '/admin/newsletter-subscribers',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Newsletter sign-ups',
        description: 'Newest first. `active` excludes people who unsubscribed.',
        querystring: pageSchema.extend({ limit: z.coerce.number().int().min(1).max(5000).default(500) }),
        response: {
          200: z.object({
            subscribers: z.array(z.object({ email: z.string(), subscribedAt: z.iso.datetime(), unsubscribedAt: z.iso.datetime().nullable() })),
            total: z.number().int(),
            active: z.number().int(),
          }),
        },
      },
    },
    async (request) => {
      const [rows, [{ total }], [{ active }]] = await Promise.all([
        db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.createdAt)).limit(request.query.limit).offset(request.query.offset),
        db.select({ total: count() }).from(newsletterSubscribers),
        db.select({ active: count() }).from(newsletterSubscribers).where(isNull(newsletterSubscribers.unsubscribedAt)),
      ])
      return {
        total,
        active,
        subscribers: rows.map((s) => ({ email: s.email, subscribedAt: s.createdAt.toISOString(), unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null })),
      }
    },
  )
}
