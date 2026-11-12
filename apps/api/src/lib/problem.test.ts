import { afterAll, describe, expect, it } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'
import { rateLimitError, registerErrorHandler } from './problem.js'

/* A 429 from the limiter is the same problem shape as every other error. */

const app = Fastify()
registerErrorHandler(app)
await app.register(rateLimit, { max: 1, timeWindow: '1 minute', errorResponseBuilder: rateLimitError })
app.get('/limited', async () => ({ ok: true }))

afterAll(() => app.close())

describe('rate-limit responses', () => {
  it('are an RFC 9457 problem a customer can read, with Retry-After', async () => {
    expect((await app.inject({ method: 'GET', url: '/limited' })).statusCode).toBe(200)
    const res = await app.inject({ method: 'GET', url: '/limited' })
    expect(res.statusCode).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
    expect(res.json()).toEqual({
      type: 'rate_limited',
      title: 'Too many requests',
      status: 429,
      detail: 'Too many attempts. Please wait 1 minute and try again.',
      requestId: expect.any(String),
    })
  })
})
