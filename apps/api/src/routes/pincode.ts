import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { problemSchema } from '@elegantsip/shared'
import { ApiError } from '../lib/problem.js'
import { limit } from './auth-shared.js'

const pinSchema = z.string().regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code.')

const locationSchema = z.object({
  officeName: z.string(),
  city: z.string(),
  district: z.string(),
  state: z.string(),
  country: z.literal('India'),
  deliveryStatus: z.string().nullable(),
})

type PincodeLocation = z.infer<typeof locationSchema>

type CacheEntry = { expiresAt: number; locations: PincodeLocation[] }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60 * 60 * 1000

type PostalOffice = {
  Name?: unknown
  District?: unknown
  Region?: unknown
  State?: unknown
  Country?: unknown
  DeliveryStatus?: unknown
}

/** Reduces the provider response to the fields checkout can safely use. */
export function locationsFromPostalResponse(payload: unknown): PincodeLocation[] {
  if (!Array.isArray(payload)) return []
  const first = payload[0] as { Status?: unknown; PostOffice?: unknown } | undefined
  if (first?.Status !== 'Success' || !Array.isArray(first.PostOffice)) return []

  const seen = new Set<string>()
  return first.PostOffice.flatMap((office: PostalOffice) => {
    const officeName = typeof office.Name === 'string' ? office.Name.trim() : ''
    const district = typeof office.District === 'string' ? office.District.trim() : ''
    const city = district || (typeof office.Region === 'string' ? office.Region.trim() : '')
    const state = typeof office.State === 'string' ? office.State.trim() : ''
    const country = typeof office.Country === 'string' ? office.Country.trim() : ''
    if (!officeName || !city || !state || country !== 'India') return []

    const key = `${officeName}|${city}|${state}`.toLowerCase()
    if (seen.has(key)) return []
    seen.add(key)
    return [{
      officeName,
      city,
      district,
      state,
      country: 'India' as const,
      deliveryStatus: typeof office.DeliveryStatus === 'string' ? office.DeliveryStatus.trim() || null : null,
    }]
  })
}

export const pincodeRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/locations/pincode/:pincode',
    {
      config: limit(60, '1 minute'),
      schema: {
        tags: ['Locations'],
        summary: 'Look up India Post localities for a PIN code',
        description:
          'Returns postal localities suitable for checkout autofill. City is derived from the India Post district; customers still enter their street address manually.',
        params: z.object({ pincode: pinSchema }),
        response: { 200: z.object({ pincode: pinSchema, locations: z.array(locationSchema) }), 503: problemSchema },
      },
    },
    async (request) => {
      const { pincode } = request.params
      const cached = cache.get(pincode)
      if (cached && cached.expiresAt > Date.now()) return { pincode, locations: cached.locations }

      try {
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
          signal: AbortSignal.timeout(5_000),
          headers: { Accept: 'application/json' },
        })
        if (!response.ok) throw new Error(`Postal provider returned ${response.status}`)
        const locations = locationsFromPostalResponse(await response.json())
        cache.set(pincode, { locations, expiresAt: Date.now() + CACHE_TTL_MS })
        return { pincode, locations }
      } catch (error) {
        request.log.warn({ err: error }, 'PIN code provider lookup failed')
        throw new ApiError(
          503,
          'pincode_lookup_unavailable',
          'PIN code suggestions unavailable',
          'PIN code suggestions are temporarily unavailable. You can still enter your address manually.',
        )
      }
    },
  )
}
