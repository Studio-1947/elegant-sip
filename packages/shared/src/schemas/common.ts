import { z } from 'zod'

/* ────────────────────────────────────────────────────────────────────────────
 * Cross-cutting schemas: errors and pagination.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * One error shape for the whole API, modelled on RFC 9457 (Problem Details).
 *
 * A single shape means the storefront writes one error handler instead of one
 * per endpoint, and `detail` is always safe to show a customer — internal
 * causes go to the logs under `requestId`, never into the response.
 */
export const problemSchema = z.object({
  type: z
    .string()
    .describe('Stable machine-readable slug, e.g. "validation_error", "out_of_stock"'),
  title: z.string().describe('Short human-readable summary'),
  status: z.number().int().min(400).max(599),
  detail: z.string().describe('What went wrong and what to do about it — displayable as-is'),
  /** Field-level messages, keyed by path. Present on validation failures. */
  errors: z.record(z.string(), z.array(z.string())).optional(),
  requestId: z.string().describe('Correlates this response with the server logs'),
})

export type Problem = z.infer<typeof problemSchema>

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional().describe('Opaque cursor from a previous page'),
})

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptime: z.number().describe('Seconds since process start'),
  version: z.string(),
})

export const readyResponseSchema = z.object({
  status: z.enum(['ready', 'degraded']),
  checks: z.record(z.string(), z.enum(['up', 'down'])),
})
