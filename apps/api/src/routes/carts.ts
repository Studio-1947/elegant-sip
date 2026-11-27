import { and, desc, eq, inArray, isNull, lt, sql, type SQL } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { cartLineInputSchema, paiseSchema } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { productVariants, products } from '../db/schema.js'
import { carts, orders, users, type CartLineSnapshot } from '../db/schema-commerce.js'
import { unitPrice, variantPricingColumns } from '../lib/catalogue-pricing.js'
import { limit } from './auth-shared.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Carts, so staff can see what shoppers leave behind.
 *
 * The browser keeps the working cart and sends a copy here whenever it
 * changes, under a random ID of its own. The server prices that copy from the
 * catalogue (prices in the request are never read) and links it to the order
 * the cart becomes. Once linked, a cart no longer changes, and the browser
 * starts a new one.
 *
 * What staff see, for carts with something in them:
 *   · active            changed in the last hour, or its order is awaiting payment
 *   · abandoned         left for over an hour without reaching an order
 *   · payment_abandoned became an order whose payment was never completed
 *   · ordered           became a paid order
 * ──────────────────────────────────────────────────────────────────────────── */

/** A cart untouched for this long, with no order, counts as abandoned. */
export const ABANDONED_AFTER_MINUTES = 60
/** Carts that never became an order are deleted after this many days. */
export const CART_RETENTION_DAYS = 90

export const CART_STATUSES = ['active', 'abandoned', 'payment_abandoned', 'ordered'] as const
export type CartStatus = (typeof CART_STATUSES)[number]

/** Prices cart lines from the catalogue. Lines for teas that no longer exist are dropped. */
async function snapshot(lines: { productSlug: string; variantSize: string; quantity: number }[]): Promise<CartLineSnapshot[]> {
  if (lines.length === 0) return []
  const rows = await db
    .select(variantPricingColumns)
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(products.slug, [...new Set(lines.map((l) => l.productSlug))]))
  const out: CartLineSnapshot[] = []
  for (const line of lines) {
    const row = rows.find((r) => r.slug === line.productSlug && r.size === line.variantSize)
    if (!row) continue
    out.push({ productSlug: row.slug, productName: row.name, variantSize: row.size, quantity: line.quantity, unitPrice: unitPrice(row) })
  }
  return out
}

const totals = (items: CartLineSnapshot[]) => ({
  itemCount: items.reduce((n, i) => n + i.quantity, 0),
  subtotal: items.reduce((n, i) => n + i.unitPrice * i.quantity, 0),
})

/**
 * Records that a cart became an order. Creates the cart from the order's lines
 * if the browser's copy never arrived. A cart already linked keeps its order.
 */
export async function linkCartToOrder(cartId: string, order: { id: string; userId: string | null }, items: CartLineSnapshot[]) {
  const now = new Date()
  await db
    .insert(carts)
    .values({ id: cartId, userId: order.userId, items, ...totals(items), orderId: order.id, checkoutStartedAt: now })
    .onConflictDoUpdate({
      target: carts.id,
      set: { orderId: order.id, updatedAt: now, checkoutStartedAt: sql`coalesce(${carts.checkoutStartedAt}, now())` },
      setWhere: isNull(carts.orderId),
    })
}

/** Deletes carts that never became an order and have not changed for the retention period. */
export async function purgeStaleCarts(days = CART_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const deleted = await db
    .delete(carts)
    .where(and(isNull(carts.orderId), lt(carts.updatedAt, cutoff)))
    .returning({ id: carts.id })
  return deleted.length
}

export const cartRoutes: FastifyPluginAsyncZod = async (app) => {
  app.put(
    '/carts/:id',
    {
      bodyLimit: 16 * 1024,
      config: limit(120, '1 minute'),
      schema: {
        tags: ['Orders'],
        summary: "Save a copy of the shopper's cart",
        description: [
          'Called by the storefront whenever the cart changes, with an ID the browser made.',
          'The lines are priced from the catalogue; no prices are accepted. A signed-in shopper',
          'is attached to the cart. `checkout: true` records that checkout was opened.',
          'A cart that has become an order no longer changes. Always 204.',
        ].join('\n'),
        params: z.object({ id: z.string().uuid() }),
        body: z.object({
          items: z.array(cartLineInputSchema).max(50),
          checkout: z.boolean().optional(),
        }),
        response: { 204: z.null().describe('Saved') },
      },
    },
    async (request, reply) => {
      const { id } = request.params
      const { items: lines, checkout } = request.body
      const userId = request.session?.userId ?? null
      const items = await snapshot(lines)
      const now = new Date()
      const startedAt = checkout ? sql`coalesce(${carts.checkoutStartedAt}, now())` : sql`${carts.checkoutStartedAt}`

      if (items.length === 0) {
        // Emptied: keep the row (it may have history) but nothing is left in it.
        await db
          .update(carts)
          .set({ items: [], itemCount: 0, subtotal: 0, updatedAt: now, ...(userId ? { userId } : {}) })
          .where(and(eq(carts.id, id), isNull(carts.orderId)))
      } else {
        await db
          .insert(carts)
          .values({ id, userId, items, ...totals(items), checkoutStartedAt: checkout ? now : null })
          .onConflictDoUpdate({
            target: carts.id,
            set: { items, ...totals(items), updatedAt: now, checkoutStartedAt: startedAt, ...(userId ? { userId } : {}) },
            setWhere: isNull(carts.orderId),
          })
      }
      return reply.status(204).send(null)
    },
  )
}

/* ── Staff ────────────────────────────────────────────────────────────────── */

// The threshold is written into the SQL (it is a constant, not input) so the
// same expression can be both selected and grouped by.
const statusSql = sql<CartStatus>`case
  when ${orders.paidAt} is not null then 'ordered'
  when ${orders.status} = 'pending_payment' then 'active'
  when ${orders.status} = 'cancelled' then 'payment_abandoned'
  when ${carts.updatedAt} > now() - make_interval(mins => ${sql.raw(String(ABANDONED_AFTER_MINUTES))}) then 'active'
  else 'abandoned'
end`

const cartRow = z.object({
  id: z.string().uuid(),
  status: z.enum(CART_STATUSES),
  items: z.array(z.object({ productSlug: z.string(), productName: z.string(), variantSize: z.string(), quantity: z.number().int(), unitPrice: paiseSchema })),
  itemCount: z.number().int(),
  subtotal: paiseSchema,
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  checkoutStartedAt: z.iso.datetime().nullable(),
  customer: z
    .object({ userId: z.string().uuid().nullable(), name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() })
    .nullable()
    .describe('From the account, else from the unpaid order. Null for a guest who never reached an order.'),
  order: z.object({ number: z.string(), status: z.string(), total: paiseSchema }).nullable(),
})

export const adminCartRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/carts',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Shopping carts, including abandoned ones',
        description: [
          `Most recent activity first. Carts that never had anything in them are left out.`,
          `\`abandoned\`: untouched for ${ABANDONED_AFTER_MINUTES} minutes without an order. \`payment_abandoned\`: became an order that was never paid.`,
          '`summary` counts carts active in the last `days` days, by status.',
        ].join('\n'),
        querystring: z.object({
          status: z.enum(CART_STATUSES).optional(),
          days: z.coerce.number().int().min(1).max(CART_RETENTION_DAYS).default(30),
          limit: z.coerce.number().int().min(1).max(200).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        }),
        response: {
          200: z.object({
            carts: z.array(cartRow),
            total: z.number().int(),
            summary: z.object({
              days: z.number().int(),
              counts: z.object({ active: z.number().int(), abandoned: z.number().int(), payment_abandoned: z.number().int(), ordered: z.number().int() }),
              /** Paise left in abandoned carts and unpaid orders. */
              abandonedValue: paiseSchema,
            }),
          }),
        },
      },
    },
    async (request) => {
      const { status, days, limit: pageSize, offset } = request.query
      const since = sql`${carts.updatedAt} > now() - make_interval(days => ${days})`
      // Something was in the cart, or it became an order.
      const hasContents = sql`(${carts.itemCount} > 0 or ${carts.orderId} is not null)`
      const where: SQL[] = [hasContents, since]
      if (status) where.push(sql`${statusSql} = ${status}`)

      const [rows, [{ total }], grouped] = await Promise.all([
        db
          .select({
            cart: carts,
            status: statusSql,
            userName: users.name,
            userEmail: users.email,
            userPhone: users.phone,
            orderNumber: orders.number,
            orderStatus: orders.status,
            orderTotal: orders.total,
            orderEmail: orders.email,
            orderName: orders.shippingName,
            orderPhone: orders.shippingPhone,
          })
          .from(carts)
          .leftJoin(users, eq(carts.userId, users.id))
          .leftJoin(orders, eq(carts.orderId, orders.id))
          .where(and(...where))
          .orderBy(desc(carts.updatedAt))
          .limit(pageSize)
          .offset(offset),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(carts)
          .leftJoin(orders, eq(carts.orderId, orders.id))
          .where(and(...where)),
        db
          .select({
            status: statusSql,
            n: sql<number>`count(*)::int`,
            value: sql<number>`coalesce(sum(coalesce(${orders.total}, ${carts.subtotal})), 0)::int`,
          })
          .from(carts)
          .leftJoin(orders, eq(carts.orderId, orders.id))
          .where(and(hasContents, since))
          .groupBy(statusSql),
      ])

      const counts = { active: 0, abandoned: 0, payment_abandoned: 0, ordered: 0 }
      let abandonedValue = 0
      for (const g of grouped) {
        counts[g.status] = g.n
        if (g.status === 'abandoned' || g.status === 'payment_abandoned') abandonedValue += g.value
      }

      return {
        total,
        summary: { days, counts, abandonedValue },
        carts: rows.map((r) => {
          const known = r.cart.userId !== null || r.orderEmail !== null
          return {
            id: r.cart.id,
            status: r.status,
            items: r.cart.items,
            itemCount: r.cart.itemCount,
            subtotal: r.cart.subtotal,
            createdAt: r.cart.createdAt.toISOString(),
            lastActivityAt: r.cart.updatedAt.toISOString(),
            checkoutStartedAt: r.cart.checkoutStartedAt?.toISOString() ?? null,
            customer: known
              ? {
                  userId: r.cart.userId,
                  name: r.userName ?? r.orderName,
                  email: r.userEmail ?? r.orderEmail,
                  phone: r.userPhone ?? r.orderPhone,
                }
              : null,
            order: r.orderNumber ? { number: r.orderNumber, status: r.orderStatus!, total: r.orderTotal! } : null,
          }
        }),
      }
    },
  )
}
