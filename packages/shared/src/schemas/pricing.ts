import { z } from 'zod'
import { paiseSchema, slugSchema } from './catalogue.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Pricing and cart schemas.
 *
 * Note what the request does NOT accept: a price, a subtotal or a total. The
 * client sends only what the customer chose — which product, which variant,
 * how many — and the server prices it from the catalogue. Accepting a price
 * from the browser is how storefronts get robbed.
 * ──────────────────────────────────────────────────────────────────────────── */

export const cartLineInputSchema = z.object({
  productSlug: slugSchema,
  variantSize: z.string().min(1).describe('Variant label, e.g. "Premium · 100 g"'),
  quantity: z.number().int().min(1).max(99),
})

export const shippingMethodIdSchema = z.enum(['standard', 'express'])

export const pricingQuoteRequestSchema = z.object({
  items: z.array(cartLineInputSchema).min(1).max(50),
  couponCode: z.string().trim().toUpperCase().max(32).optional(),
  shippingMethod: shippingMethodIdSchema.default('standard'),
})

export const pricedLineSchema = z.object({
  productSlug: slugSchema,
  productName: z.string(),
  variantSize: z.string(),
  imageSrc: z.string(),
  quantity: z.number().int().min(1),
  unitPrice: paiseSchema.describe('Priced from the catalogue, never from the request'),
  lineTotal: paiseSchema,
})

export const pricingQuoteResponseSchema = z.object({
  items: z.array(pricedLineSchema),
  subtotal: paiseSchema,
  discount: paiseSchema,
  coupon: z
    .object({ code: z.string(), percentOff: z.number() })
    .nullable()
    .describe('Null when no code was sent, or the code was rejected'),
  couponError: z
    .string()
    .nullable()
    .describe('Why the submitted code was not applied — shown to the customer verbatim'),
  shippingMethod: shippingMethodIdSchema,
  shippingFee: paiseSchema,
  tax: paiseSchema.describe('GST at 5% on goods and shipping, rounded to a whole rupee'),
  total: paiseSchema,
  amountToFreeShipping: paiseSchema,
  adjustments: z
    .array(
      z.object({
        productSlug: slugSchema,
        variantSize: z.string(),
        reason: z.enum(['out_of_stock', 'quantity_reduced', 'unavailable', 'price_changed']),
        message: z.string(),
      }),
    )
    .describe('Lines the server changed or dropped. The UI must show these — silently altering a cart is exactly the kind of thing this storefront does not do'),
})

export const couponValidateRequestSchema = z.object({
  code: z.string().trim().toUpperCase().min(1).max(32),
  subtotal: paiseSchema,
})

export const couponValidateResponseSchema = z.object({
  valid: z.boolean(),
  code: z.string(),
  percentOff: z.number().nullable(),
  discount: paiseSchema,
  message: z.string().nullable().describe('Reason for rejection, safe to display'),
})

export type CartLineInput = z.infer<typeof cartLineInputSchema>
export type PricingQuoteRequest = z.infer<typeof pricingQuoteRequestSchema>
export type PricingQuoteResponse = z.infer<typeof pricingQuoteResponseSchema>
