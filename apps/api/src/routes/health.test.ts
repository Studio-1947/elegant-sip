import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { FastifyInstance } from 'fastify'

// The real check, unless a test says otherwise.
const pingDatabase = vi.hoisted(() => vi.fn<() => Promise<boolean>>())
vi.mock('../db/client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../db/client.js')>()
  pingDatabase.mockImplementation(real.pingDatabase)
  return { ...real, pingDatabase }
})

import { buildApp } from '../app.js'
import { db, sql } from '../db/client.js'
import { redis } from '../lib/sessions.js'
import { invalidateStoreSettings } from '../lib/settings.js'

/* Readiness reports each dependency, and is unready when any one is down. */

let app: FastifyInstance
let available = true

beforeAll(async () => {
  try {
    await sql`SELECT 1`
    await redis.ping()
  } catch {
    available = false
    return
  }
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  vi.restoreAllMocks()
  if (app) await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

const ready = () => app.inject({ method: 'GET', url: '/ready' })

describe('GET /ready', () => {
  it('is ready when PostgreSQL and Redis both answer', async () => {
    if (!available) return
    const res = await ready()
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ready', checks: { database: 'up', redis: 'up' } })
  })

  it('is degraded when Redis fails', async () => {
    if (!available) return
    vi.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('connection refused'))
    const res = await ready()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'degraded', checks: { database: 'up', redis: 'down' } })
  })

  it('does not wait on a Redis that never answers', async () => {
    if (!available) return
    vi.spyOn(redis, 'ping').mockImplementationOnce(() => new Promise<'PONG'>(() => {}))
    const started = Date.now()
    const res = await ready()
    expect(res.statusCode).toBe(503)
    expect(res.json().checks.redis).toBe('down')
    expect(Date.now() - started).toBeLessThan(3_000)
  })

  it('is degraded when PostgreSQL fails', async () => {
    if (!available) return
    pingDatabase.mockResolvedValueOnce(false)
    const res = await ready()
    expect(res.statusCode).toBe(503)
    expect(res.json()).toEqual({ status: 'degraded', checks: { database: 'down', redis: 'up' } })
  })
})

describe('GET /storefront-status', () => {
  it('reports payments, guest checkout and the guarantee', async () => {
    if (!available) return
    const res = await app.inject({ method: 'GET', url: '/storefront-status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      paymentsAvailable: expect.any(Boolean),
      guestCheckout: expect.any(Boolean),
      guarantee: { enabled: expect.any(Boolean), days: expect.any(Number) },
    })
  })

  it('still answers, with the safe defaults, when the settings cannot be read', async () => {
    if (!available) return
    invalidateStoreSettings()
    vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('connection refused')
    })
    const res = await app.inject({ method: 'GET', url: '/storefront-status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ guestCheckout: false, guarantee: { enabled: true, days: 30 } })
    invalidateStoreSettings()
  })
})
