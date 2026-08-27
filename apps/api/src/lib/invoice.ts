import { eq, sql } from 'drizzle-orm'
import { TAX_RATE, formatPaise } from '@elegantsip/shared'
import { db } from '../db/client.js'
import { invoices, orderItems, orders } from '../db/schema-commerce.js'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * GST invoices.
 *
 * Three things Indian tax law requires that are easy to get wrong:
 *
 *  1. AN UNBROKEN SEQUENCE per financial year. The Indian FY runs April–March,
 *     so an order placed on 31 March and one placed on 1 April belong to
 *     different series. The number is allocated inside a transaction against a
 *     unique (financial_year, sequence) constraint, so two concurrent captures
 *     cannot take the same number.
 *
 *  2. THE RIGHT TAX SPLIT. Supply within the seller's own state is CGST + SGST
 *     at half the rate each; supply to another state is a single IGST line at
 *     the full rate. The customer pays 5% either way — but the invoice is a
 *     legal document and the lines must be correct.
 *
 *  3. HSN CODE. Tea is 0902.
 *
 * Without SELLER_GSTIN configured this still produces a document, but it is
 * labelled a "Provisional invoice" rather than a "Tax invoice" — claiming to
 * be a tax invoice without a GSTIN would be a false statement on a legal
 * record, which is exactly the sort of thing this project does not do.
 * ──────────────────────────────────────────────────────────────────────────── */

export const HSN_TEA = '0902'

/** Indian financial year for a date: April–March, expressed as "2026-27". */
export function financialYearOf(date: Date): string {
  const year = date.getUTCFullYear()
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`
}

/** Normalises state names so "west bengal" and "West Bengal" compare equal. */
const normaliseState = (s: string | null | undefined) => (s ?? '').trim().toLowerCase()

export interface InvoiceTotals {
  isIntraState: boolean
  cgst: number
  sgst: number
  igst: number
}

/**
 * Splits an order's GST across the correct heads.
 *
 * The order's `tax` figure is authoritative — it is what the customer was
 * charged. Splitting it in half for intra-state supply can leave a one-paisa
 * remainder; it is assigned to CGST so the parts always sum to the whole.
 */
export function splitGst(taxTotal: number, deliveryState: string | null): InvoiceTotals {
  const isIntraState = normaliseState(deliveryState) === normaliseState(env.SELLER_STATE)
  if (!isIntraState) return { isIntraState: false, cgst: 0, sgst: 0, igst: taxTotal }
  const half = Math.floor(taxTotal / 2)
  return { isIntraState: true, cgst: taxTotal - half, sgst: half, igst: 0 }
}

export interface IssuedInvoice {
  number: string
  financialYear: string
  sequence: number
  isTaxInvoice: boolean
}

/**
 * Allocates an invoice number for a paid order. Idempotent — an order that
 * already has an invoice keeps the one it has, because reissuing under a new
 * number would break the sequence.
 */
export async function issueInvoice(orderId: string): Promise<IssuedInvoice | null> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
  if (!order) return null

  const existing = await db.query.invoices.findFirst({ where: eq(invoices.orderId, orderId) })
  if (existing) {
    return {
      number: existing.number,
      financialYear: existing.financialYear,
      sequence: existing.sequence,
      isTaxInvoice: existing.sellerGstin !== null,
    }
  }

  const issuedAt = order.paidAt ?? new Date()
  const financialYear = financialYearOf(issuedAt)
  const split = splitGst(order.tax, order.shippingState)

  return db.transaction(async (tx) => {
    /*
     * Serialise sequence allocation across concurrent captures.
     *
     * `SELECT MAX(...) FOR UPDATE` is not an option — Postgres rejects row
     * locking on an aggregate — and there is no row to lock for a number that
     * does not exist yet. A transaction-scoped advisory lock keyed on the
     * financial year is the right instrument: it is released automatically on
     * commit or rollback, and two captures in the same year queue rather than
     * both reading the same MAX. The unique (financial_year, sequence)
     * constraint remains the backstop.
     */
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`invoice:${financialYear}`}))`)

    const [row] = await tx
      .select({ max: sql<number>`COALESCE(MAX(${invoices.sequence}), 0)` })
      .from(invoices)
      .where(eq(invoices.financialYear, financialYear))

    const sequence = Number(row?.max ?? 0) + 1
    const number = `ES/${financialYear}/${String(sequence).padStart(4, '0')}`

    await tx.insert(invoices).values({
      orderId,
      number,
      financialYear,
      sequence,
      sellerGstin: env.SELLER_GSTIN ?? null,
      placeOfSupply: order.shippingState ?? order.shippingCity,
      isIntraState: split.isIntraState,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
      issuedAt,
    })

    return { number, financialYear, sequence, isTaxInvoice: env.SELLER_GSTIN !== undefined }
  })
}

export interface InvoiceView {
  number: string
  issuedAt: string
  isTaxInvoice: boolean
  sellerGstin: string | null
  placeOfSupply: string
  hsn: string
  taxRatePercent: number
  lines: { description: string; quantity: number; unitPrice: string; lineTotal: string }[]
  totals: {
    subtotal: string
    discount: string
    shipping: string
    cgst: string | null
    sgst: string | null
    igst: string | null
    total: string
  }
  buyer: { name: string; line1: string; city: string; postalCode: string; state: string | null }
}

/** Everything a rendered invoice needs, with money pre-formatted. */
export async function getInvoiceView(orderId: string): Promise<InvoiceView | null> {
  const order = await db.query.orders.findFirst({ where: eq(orders.id, orderId) })
  if (!order) return null
  const record = await db.query.invoices.findFirst({ where: eq(invoices.orderId, orderId) })
  if (!record) return null
  const lines = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))

  return {
    number: record.number,
    issuedAt: record.issuedAt.toISOString(),
    isTaxInvoice: record.sellerGstin !== null,
    sellerGstin: record.sellerGstin,
    placeOfSupply: record.placeOfSupply,
    hsn: HSN_TEA,
    taxRatePercent: TAX_RATE * 100,
    lines: lines.map((l) => ({
      description: `${l.productName} — ${l.variantSize}`,
      quantity: l.quantity,
      unitPrice: formatPaise(l.unitPrice),
      lineTotal: formatPaise(l.lineTotal),
    })),
    totals: {
      subtotal: formatPaise(order.subtotal),
      discount: formatPaise(order.discount),
      shipping: formatPaise(order.shippingFee),
      cgst: record.isIntraState ? formatPaise(record.cgst) : null,
      sgst: record.isIntraState ? formatPaise(record.sgst) : null,
      igst: record.isIntraState ? null : formatPaise(record.igst),
      total: formatPaise(order.total),
    },
    buyer: {
      name: order.shippingName,
      line1: order.shippingLine1,
      city: order.shippingCity,
      postalCode: order.shippingPostalCode,
      state: order.shippingState,
    },
  }
}
