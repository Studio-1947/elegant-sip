import { and, eq, sql } from 'drizzle-orm'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import {
  calculatePricing,
  couponDiscount,
  couponValidateRequestSchema,
  couponValidateResponseSchema,
  pricingQuoteRequestSchema,
  pricingQuoteResponseSchema,
  problemSchema,
} from '@elegantsip/shared'
import { db } from '../db/client.js'
import { coupons, productVariants, products } from '../db/schema.js'
import { ApiError } from '../lib/problem.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Pricing — the server is the authority.
 *
 * The request carries no prices. It says which product, which variant and how
 * many; everything monetary is looked up from the catalogue. This is the whole
 * point of the endpoint: before it existed, a customer could edit localStorage
 * and pay whatever they liked.
 *
 * When the server changes a line — a variant sold out, a quantity clamped to
 * stock — it says so explicitly in `adjustments` rather than quietly returning
 * a different cart. Silently altering someone's basket is precisely the sort
 * of thing this storefront does not do.
 * ──────────────────────────────────────────────────────────────────────────── */

type Adjustment = {
  productSlug: string
  variantSize: string
  reason: 'out_of_stock' | 'quantity_reduced' | 'unavailable' | 'price_changed'
  message: string
}

async function resolveCoupon(code: string | undefined, subtotal: number) {
  if (!code) return { coupon: null, discount: 0, couponError: null }

  const row = await db.query.coupons.findFirst({ where: eq(coupons.code, code) })
  if (!row || !row.active) {
    return { coupon: null, discount: 0, couponError: `"${code}" is not a valid code.` }
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return { coupon: null, discount: 0, couponError: `"${code}" has expired.` }
  }
  if (row.maxRedemptions !== null && row.redemptionCount >= row.maxRedemptions) {
    return { coupon: null, discount: 0, couponError: `"${code}" has been fully redeemed.` }
  }
  const rule = {
    code: row.code,
    percentOff: row.percentOff / 100,
    minSubtotal: row.minSubtotal ?? undefined,
  }
  const discount = couponDiscount(rule, subtotal)
  if (discount === 0 && row.minSubtotal) {
    return {
      coupon: null,
      discount: 0,
      couponError: `"${code}" applies to orders over ₹${Math.round(row.minSubtotal / 100)}.`,
    }
  }
  return { coupon: { code: row.code, percentOff: rule.percentOff }, discount, couponError: null }
}

export const pricingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/pricing/quote',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'Price a cart',
        description: [
          'Takes a cart of product/variant/quantity and returns the authoritative money.',
          '',
          '**No prices are accepted in the request.** Everything is priced from the catalogue,',
          'so a tampered client cannot change what it pays. Lines the server had to change or',
          'drop come back in `adjustments` — show them to the customer rather than silently',
          'reconciling.',
          '',
          'GST is 5% on goods *and* shipping, rounded to a whole rupee by the same shared rule',
          'the storefront uses for display.',
        ].join('\n'),
        body: pricingQuoteRequestSchema,
        response: { 200: pricingQuoteResponseSchema, 400: problemSchema },
      },
    },
    async (request) => {
      const { items, couponCode, shippingMethod } = request.body
      const adjustments: Adjustment[] = []
      const priced: {
        productSlug: string
        productName: string
        variantSize: string
        imageSrc: string
        quantity: number
        unitPrice: number
        lineTotal: number
      }[] = []

      for (const line of items) {
        const row = await db
          .select({
            slug: products.slug,
            name: products.name,
            imageSrc: products.imageSrc,
            status: products.status,
            size: productVariants.size,
            price: productVariants.price,
            stock: productVariants.stock,
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(and(eq(products.slug, line.productSlug), eq(productVariants.size, line.variantSize)))
          .limit(1)
          .then((r) => r[0])

        if (!row) {
          adjustments.push({
            productSlug: line.productSlug,
            variantSize: line.variantSize,
            reason: 'unavailable',
            message: 'This tea is no longer in the catalogue and has been removed from your cart.',
          })
          continue
        }

        if (row.status === 'coming-soon') {
          adjustments.push({
            productSlug: row.slug,
            variantSize: row.size,
            reason: 'unavailable',
            message: `${row.name} has not been released yet and cannot be ordered.`,
          })
          continue
        }

        if (row.stock <= 0) {
          adjustments.push({
            productSlug: row.slug,
            variantSize: row.size,
            reason: 'out_of_stock',
            message: `${row.name} (${row.size}) has sold out.`,
          })
          continue
        }

        const quantity = Math.min(line.quantity, row.stock)
        if (quantity < line.quantity) {
          adjustments.push({
            productSlug: row.slug,
            variantSize: row.size,
            reason: 'quantity_reduced',
            message: `Only ${row.stock} of ${row.name} (${row.size}) left — the quantity has been reduced.`,
          })
        }

        priced.push({
          productSlug: row.slug,
          productName: row.name,
          variantSize: row.size,
          imageSrc: row.imageSrc,
          quantity,
          unitPrice: row.price,
          lineTotal: row.price * quantity,
        })
      }

      if (priced.length === 0) {
        throw ApiError.badRequest(
          'None of the items in this cart can be ordered right now. See `adjustments` for why.',
        )
      }

      const subtotal = priced.reduce((a, l) => a + l.lineTotal, 0)
      const { coupon, discount, couponError } = await resolveCoupon(couponCode, subtotal)
      const pricing = calculatePricing({ subtotal, discount, shippingMethod })

      return {
        items: priced,
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        coupon,
        couponError,
        shippingMethod,
        shippingFee: pricing.shippingFee,
        tax: pricing.tax,
        total: pricing.total,
        amountToFreeShipping: pricing.amountToFreeShipping,
        adjustments,
      }
    },
  )

  app.post(
    '/coupons/validate',
    {
      schema: {
        tags: ['Pricing'],
        summary: 'Check a coupon code',
        description:
          'Eligibility lives here, not in the client. Before this endpoint the codes were hardcoded in the browser bundle and trivially bypassed.',
        body: couponValidateRequestSchema,
        response: { 200: couponValidateResponseSchema },
      },
    },
    async (request) => {
      const { code, subtotal } = request.body
      const { coupon, discount, couponError } = await resolveCoupon(code, subtotal)
      return {
        valid: coupon !== null,
        code,
        percentOff: coupon?.percentOff ?? null,
        discount,
        message: couponError,
      }
    },
  )
}

/** Increments a coupon's redemption counter atomically. Used from phase 03. */
export const consumeCoupon = (code: string) =>
  db
    .update(coupons)
    .set({ redemptionCount: sql`${coupons.redemptionCount} + 1` })
    .where(eq(coupons.code, code))
