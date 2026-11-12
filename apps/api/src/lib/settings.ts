import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { storeSettings, users } from '../db/schema-commerce.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Shop-wide settings staff change from the admin page (the single
 * store_settings row).
 *
 * Read on hot paths (every checkout, the storefront status), so the row is
 * cached in-process for a short while. A PATCH clears the cache here at once;
 * another instance picks the change up when its cache expires.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface StoreSettings {
  guestCheckoutEnabled: boolean
  guaranteeEnabled: boolean
  guaranteeDays: number
  lowStockThreshold: number
  newOrderAlerts: boolean
}

/** The column defaults, i.e. how the shop behaved before these were settings. */
export const DEFAULT_STORE_SETTINGS: Readonly<StoreSettings> = Object.freeze({
  guestCheckoutEnabled: false,
  guaranteeEnabled: true,
  guaranteeDays: 30,
  lowStockThreshold: 5,
  newOrderAlerts: true,
})

const CACHE_MS = 30_000

let cached: { value: StoreSettings; expiresAt: number } | null = null
let inflight: Promise<StoreSettings> | null = null

const pick = (row: StoreSettings): StoreSettings => ({
  guestCheckoutEnabled: row.guestCheckoutEnabled,
  guaranteeEnabled: row.guaranteeEnabled,
  guaranteeDays: row.guaranteeDays,
  lowStockThreshold: row.lowStockThreshold,
  newOrderAlerts: row.newOrderAlerts,
})

/**
 * The current settings. Never throws: if the database cannot be read it
 * returns the last value it saw, or the defaults (guest checkout off), so a
 * failed read can only make the shop stricter than configured, not looser.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value
  // Concurrent callers share one query.
  inflight ??= loadStoreSettings().finally(() => {
    inflight = null
  })
  return inflight
}

async function loadStoreSettings(): Promise<StoreSettings> {
  try {
    const [row] = await db.select().from(storeSettings).where(eq(storeSettings.id, 1))
    const value = row ? pick(row) : { ...DEFAULT_STORE_SETTINGS }
    cached = { value, expiresAt: Date.now() + CACHE_MS }
    return value
  } catch {
    // Not cached, so the next call tries the database again.
    return cached?.value ?? { ...DEFAULT_STORE_SETTINGS }
  }
}

/** Forget the cached row, so the next read sees the database. */
export function invalidateStoreSettings(): void {
  cached = null
}

export interface StoreSettingsRecord extends StoreSettings {
  updatedAt: string | null
  updatedBy: { name: string; email: string } | null
}

/** The row as staff see it, read straight from the database (no cache). */
export async function readStoreSettingsRecord(): Promise<StoreSettingsRecord> {
  const [row] = await db
    .select({
      guestCheckoutEnabled: storeSettings.guestCheckoutEnabled,
      guaranteeEnabled: storeSettings.guaranteeEnabled,
      guaranteeDays: storeSettings.guaranteeDays,
      lowStockThreshold: storeSettings.lowStockThreshold,
      newOrderAlerts: storeSettings.newOrderAlerts,
      updatedAt: storeSettings.updatedAt,
      updatedByName: users.name,
      updatedByEmail: users.email,
    })
    .from(storeSettings)
    .leftJoin(users, eq(storeSettings.updatedBy, users.id))
    .where(eq(storeSettings.id, 1))
  if (!row) return { ...DEFAULT_STORE_SETTINGS, updatedAt: null, updatedBy: null }
  return {
    ...pick(row),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByEmail ? { name: row.updatedByName ?? '', email: row.updatedByEmail } : null,
  }
}

/** Applies a partial change, stamps who made it, and clears the cache. */
export async function updateStoreSettings(change: Partial<StoreSettings>, actorId: string): Promise<StoreSettingsRecord> {
  const stamp = { updatedAt: new Date(), updatedBy: actorId }
  // Upsert: the migration inserts the row, but a missing one must not make staff edits vanish.
  await db
    .insert(storeSettings)
    .values({ id: 1, ...change, ...stamp })
    .onConflictDoUpdate({ target: storeSettings.id, set: { ...change, ...stamp } })
  invalidateStoreSettings()
  return readStoreSettingsRecord()
}
