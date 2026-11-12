import type { FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { env, isProduction } from '../env.js'
import { META_EVENTS, buildServerEvent, metaCapiMode, sendMetaEvents, type MetaCustomData } from '../lib/meta-capi.js'
import { purchaseData } from '../lib/meta-purchase.js'
import { limit } from './auth-shared.js'

/* ────────────────────────────────────────────────────────────────────────────
 * The browser's Meta Pixel events, relayed to Meta's Conversions API.
 *
 * The storefront calls this only for visitors who accepted the cookie banner,
 * with the same event ID it gave the pixel, so Meta can drop the duplicate.
 * See lib/meta-capi.ts for what is sent and why.
 *
 * Anyone can post here, so:
 *   · a Purchase is reported only for an order that has really been paid, with
 *     the value and items read from the order, never from the request;
 *   · events for pages outside SITE_URL are ignored in production;
 *   · the answer is always 204, whether or not anything was sent.
 * ──────────────────────────────────────────────────────────────────────────── */

const contentSchema = z.object({
  id: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(1_000),
})

const bodySchema = z.object({
  event: z.enum(META_EVENTS),
  eventId: z.string().trim().min(8).max(100).regex(/^[\w.:-]+$/, 'letters, digits and . _ : - only'),
  url: z.string().url().max(2_000),
  /** Rupees, as the pixel gets it. Ignored for Purchase. */
  value: z.number().min(0).max(10_000_000).optional(),
  contents: z.array(contentSchema).max(50).optional(),
  numItems: z.number().int().min(0).max(10_000).optional(),
  /** Order number; required for Purchase. */
  order: z.string().trim().max(40).optional(),
})

type Body = z.infer<typeof bodySchema>

/** True for a page on this shop. Anything goes outside production. */
function onThisSite(raw: string): boolean {
  if (!isProduction) return true
  try {
    return new URL(raw).host === new URL(env.SITE_URL).host
  } catch {
    return false
  }
}

function customDataFrom(body: Body): MetaCustomData {
  const data: MetaCustomData = {}
  if (body.value !== undefined) {
    data.value = Math.round(body.value * 100) / 100
    data.currency = 'INR'
  }
  if (body.contents?.length) {
    data.content_ids = body.contents.map((c) => c.id)
    data.content_type = 'product'
    data.contents = body.contents
  }
  if (body.numItems !== undefined) data.num_items = body.numItems
  return data
}

type RelayRequest = Pick<FastifyRequest<{ Body: Body }>, 'body' | 'ip' | 'headers' | 'cookies' | 'log'>

async function relay(request: RelayRequest): Promise<void> {
  const body = request.body
  if (metaCapiMode() === 'off' || !onThisSite(body.url)) return

  let customData: MetaCustomData
  let eventId = body.eventId
  if (body.event === 'Purchase') {
    if (!body.order) return
    const data = await purchaseData(body.order)
    if (!data) return
    customData = data
    // The ID the pixel uses for this order (storefront analytics.ts).
    eventId = `purchase-${body.order}`
  } else {
    customData = customDataFrom(body)
  }

  const event = buildServerEvent({
    event: body.event,
    eventId,
    url: body.url,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
    fbp: request.cookies._fbp,
    fbc: request.cookies._fbc,
    customData,
  })
  if (event) await sendMetaEvents([event], request.log)
}

export const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/events/meta',
    {
      bodyLimit: 8 * 1024,
      config: limit(120, '1 minute'),
      schema: {
        tags: ['Reports'],
        summary: 'Relay a Meta Pixel event to the Conversions API',
        description: [
          'Called by the storefront, only after the visitor accepts cookies, with the same event ID',
          'the pixel used. A Purchase is sent only for a paid order, using its stored value and items.',
          'Always 204; nothing is sent when the Conversions API is not configured.',
        ].join('\n'),
        body: bodySchema,
        response: { 204: z.null().describe('Received') },
      },
    },
    async (request, reply) => {
      // The browser does not wait for Meta, and never hears how it went.
      void relay(request).catch((err: unknown) => request.log.error({ err }, 'meta event relay failed'))
      return reply.status(204).send(null)
    },
  )
}
