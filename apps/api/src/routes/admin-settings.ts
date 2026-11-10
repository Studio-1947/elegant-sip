import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { ApiError } from '../lib/problem.js'
import { readStoreSettingsRecord, updateStoreSettings } from '../lib/settings.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin — shop-wide settings (guest checkout, the satisfaction guarantee, the
 * low-stock threshold). Registered inside admin.ts, so the admin auth hook and
 * audit log cover it.
 * ──────────────────────────────────────────────────────────────────────────── */

const settingsSchema = z.object({
  guestCheckoutEnabled: z.boolean(),
  guaranteeEnabled: z.boolean(),
  guaranteeDays: z.number().int().min(1).max(365),
  lowStockThreshold: z.number().int().min(0).max(1000),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.object({ name: z.string(), email: z.string() }).nullable(),
})

export const adminSettingsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/settings',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Shop-wide settings',
        response: { 200: settingsSchema, 401: problemSchema, 403: problemSchema },
      },
    },
    async () => readStoreSettingsRecord(),
  )

  app.patch(
    '/admin/settings',
    {
      schema: {
        tags: ['Admin'],
        summary: 'Change shop-wide settings',
        description: 'Send only the fields to change. Takes effect on this instance at once, and on any other within 30 seconds.',
        body: z
          .object({
            guestCheckoutEnabled: z.boolean(),
            guaranteeEnabled: z.boolean(),
            guaranteeDays: z.number().int().min(1, 'At least 1 day').max(365, 'At most 365 days'),
            lowStockThreshold: z.number().int().min(0, 'Cannot be negative').max(1000, 'At most 1,000'),
          })
          .partial()
          .strict()
          .refine((change) => Object.keys(change).length > 0, 'Nothing to change.'),
        response: { 200: settingsSchema, 400: problemSchema, 401: problemSchema, 403: problemSchema },
      },
    },
    async (request) => {
      // The admin hook has already required one; this narrows the type.
      if (!request.session) throw new ApiError(401, 'unauthenticated', 'Sign in required', 'Sign in to continue.')
      return updateStoreSettings(request.body, request.session.userId)
    },
  )
}
