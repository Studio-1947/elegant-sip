import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod'
import { env, isProduction } from './env.js'
import { registerErrorHandler } from './lib/problem.js'
import { SESSION_COOKIE, readSession } from './lib/sessions.js'
import { authRoutes } from './routes/auth.js'
import { healthRoutes } from './routes/health.js'
import { accountRoutes } from './routes/account.js'
import { profileRoutes } from './routes/profile.js'
import { adminRoutes } from './routes/admin.js'
import { orderRoutes } from './routes/orders.js'
import { webhookRoutes } from './routes/webhooks.js'
import { productRoutes } from './routes/products.js'
import { gardenRoutes } from './routes/gardens.js'
import { journalRoutes } from './routes/journal.js'
import { pricingRoutes } from './routes/pricing.js'

/**
 * Builds the app without listening, so tests can drive it via `inject()`
 * without binding a port.
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      // Pretty output locally; structured JSON in production, where a log
      // aggregator is doing the reading.
      ...(isProduction
        ? {}
        : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }),
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
        remove: true,
      },
    },
    // Trust the proxy in production so rate limiting sees the real client IP
    // rather than the load balancer's.
    trustProxy: isProduction,
  }).withTypeProvider<ZodTypeProvider>()

  // Zod drives validation, serialization AND the OpenAPI document.
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)

  await app.register(helmet, {
    // Swagger UI needs inline styles/scripts; the API itself serves no HTML.
    contentSecurityPolicy: false,
  })

  await app.register(cookie)

  /*
   * Resolve the session once per request. Routes read request.session rather
   * than each hitting Redis, and an invalid or expired cookie simply yields
   * null — an unauthenticated request is not an error in itself.
   */
  app.decorateRequest('session', null)
  app.addHook('onRequest', async (request) => {
    request.session = await readSession(request.cookies[SESSION_COOKIE])
  })

  await app.register(cors, {
    origin: env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  })

  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    // Health checks are polled by the platform and must never be throttled.
    allowList: (req) => req.url === '/health' || req.url === '/ready',
    /*
     * Off under test. The suite drives dozens of sign-ins from one address in a
     * few seconds, which is indistinguishable from an attack and would make
     * unrelated tests fail with 429 depending on how many ran before them.
     * Turning it off here keeps those tests testing what they claim to; the
     * limiter itself is a production behaviour, exercised against a running
     * server rather than in-process.
     */
    global: env.NODE_ENV !== 'test',
  })

  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Elegant Sip API',
        version: '0.1.0',
        description: [
          'Backend for the Elegant Sip storefront — single-origin Darjeeling tea.',
          '',
          '**Money is integer paise** (1 rupee = 100 paise). Razorpay settles in paise and',
          'floats cannot represent money. Totals are always a whole number of rupees:',
          'GST is rounded with the same rule the storefront uses, so the figure a customer',
          'is shown and the figure they are charged cannot drift apart.',
          '',
          'Errors share one shape across every endpoint, modelled on RFC 9457. `detail` is',
          'always safe to display; `requestId` ties a response to the server logs.',
        ].join('\n'),
        contact: { name: 'Elegant Sip', email: 'elegantsipdarjeeling@gmail.com' },
      },
      servers: [
        { url: 'http://localhost:4000', description: 'Local development' },
        { url: 'https://elegantsip.in/api', description: 'Production' },
      ],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes' },
        { name: 'Catalogue', description: 'Products, gardens and journal — public and cacheable' },
        { name: 'Auth', description: 'Accounts and sessions. Cookie-based; no token is exposed to JavaScript.' },
        { name: 'Orders', description: 'Placing and reading orders. Priced from the catalogue inside a transaction.' },
        { name: 'Webhooks', description: 'Gateway callbacks. The only thing that marks an order paid.' },
        { name: 'Account', description: 'Reviews, wishlist, newsletter and contact.' },
        { name: 'Admin', description: 'Shop operations. Every route requires the admin role.' },
        { name: 'Pricing', description: 'Server-authoritative money. The client displays; it never calculates.' },
      ],
    },
    transform: jsonSchemaTransform,
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true, displayRequestDuration: true },
  })

  await app.register(healthRoutes)
  await app.register(authRoutes, { prefix: '/v1' })
  await app.register(productRoutes, { prefix: '/v1' })
  await app.register(gardenRoutes, { prefix: '/v1' })
  await app.register(journalRoutes, { prefix: '/v1' })
  await app.register(pricingRoutes, { prefix: '/v1' })
  await app.register(orderRoutes, { prefix: '/v1' })
  await app.register(webhookRoutes, { prefix: '/v1' })
  await app.register(accountRoutes, { prefix: '/v1' })
  await app.register(profileRoutes, { prefix: '/v1' })
  await app.register(adminRoutes, { prefix: '/v1' })

  return app
}
