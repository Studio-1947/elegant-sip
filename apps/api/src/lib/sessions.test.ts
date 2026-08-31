import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/*
 * The cookie policy is the difference between a customer staying signed in and
 * being silently signed out on every request, and it depends on SITE_URL — so
 * it is exercised against the deployment shapes that actually exist.
 */

const load = async (siteUrl: string, nodeEnv = 'production') => {
  vi.resetModules()
  process.env.SITE_URL = siteUrl
  process.env.NODE_ENV = nodeEnv
  process.env.DATABASE_URL ??= 'postgres://localhost:5432/test'
  const mod = await import('./sessions.js')
  return mod.sessionCookieOptions
}

const originalEnv = { ...process.env }
beforeEach(() => vi.resetModules())
afterEach(() => {
  process.env = { ...originalEnv }
})

describe('session cookie policy', () => {
  it('uses SameSite=None on a split Vercel storefront / Railway API', async () => {
    const options = await load('https://elegantsip.vercel.app')
    const cookie = options('elegant-sip-api-production.up.railway.app')
    expect(cookie.sameSite).toBe('none')
    expect(cookie.secure).toBe(true)
  })

  it('uses SameSite=Lax when the API is a subdomain of the storefront', async () => {
    const options = await load('https://elegantsip.in')
    expect(options('api.elegantsip.in').sameSite).toBe('lax')
    expect(options('elegantsip.in').sameSite).toBe('lax')
  })

  it('treats two projects on one platform as different sites', async () => {
    const options = await load('https://elegantsip.vercel.app')
    // Shares `vercel.app`, but a per-project subdomain is still cross-site.
    expect(options('elegantsip-api.vercel.app').sameSite).toBe('none')
  })

  it('stays Lax and insecure in local development', async () => {
    const options = await load('http://localhost:5173', 'development')
    const cookie = options('localhost')
    expect(cookie.sameSite).toBe('lax')
    expect(cookie.secure).toBe(false)
  })

  it('ignores a port on the request host', async () => {
    const options = await load('http://localhost:5173', 'development')
    expect(options('localhost:4000').sameSite).toBe('lax')
  })

  it('drops Secure when the site itself is served over plain HTTP', async () => {
    // A VPS reached by IP while a domain is still being arranged: marking the
    // cookie Secure there would make signing in impossible.
    const options = await load('http://203.0.113.10')
    const cookie = options('203.0.113.10')
    expect(cookie.secure).toBe(false)
    expect(cookie.sameSite).toBe('lax')
  })

  it('turns Secure back on once that same site has HTTPS', async () => {
    const options = await load('https://elegantsip.in')
    expect(options('elegantsip.in').secure).toBe(true)
  })

  it('always keeps the cookie unreadable to JavaScript', async () => {
    const options = await load('https://elegantsip.vercel.app')
    expect(options('api.up.railway.app').httpOnly).toBe(true)
  })
})
