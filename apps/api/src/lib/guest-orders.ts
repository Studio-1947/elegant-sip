import { and, eq, isNull, sql } from 'drizzle-orm'
import type { db } from '../db/client.js'
import { orders } from '../db/schema-commerce.js'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Moves guest orders placed with `email` into the account, so they show up in
 * its order history. Only ever called once the account has proved it owns the
 * address (a consumed confirmation link): matching on an unconfirmed address
 * would hand a stranger's order history to whoever typed it in.
 */
export async function claimGuestOrders(tx: Tx, userId: string, email: string): Promise<number> {
  const claimed = await tx
    .update(orders)
    .set({ userId })
    .where(and(isNull(orders.userId), eq(sql`lower(${orders.email})`, email.toLowerCase())))
    .returning({ id: orders.id })
  return claimed.length
}
