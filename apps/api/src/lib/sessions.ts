import { createHash, randomBytes } from 'node:crypto'
import Redis from 'ioredis'
import { env, isProduction } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Sessions.
 *
 * Opaque random token in an httpOnly cookie, with the session record in Redis.
 * Deliberately not a JWT in localStorage: a JWT there is readable by any XSS
 * and cannot be revoked, whereas a session can be destroyed server-side the
 * moment something looks wrong.
 *
 * Only a SHA-256 hash of the token is used as the Redis key, so a dump of
 * Redis does not hand anyone a set of usable session cookies.
 * ──────────────────────────────────────────────────────────────────────────── */

export const SESSION_COOKIE = 'es_session'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: false,
  // Never let a Redis blip take the process down; routes handle failures.
  enableOfflineQueue: true,
})

redis.on('error', (err) => {
  // Logged rather than thrown: ioredis reconnects on its own.
  console.error('[redis]', err.message)
})

export interface SessionData {
  userId: string
  email: string
  role: 'customer' | 'admin'
}

const keyFor = (token: string) => `session:${createHash('sha256').update(token).digest('hex')}`

export async function createSession(data: SessionData): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await redis.set(keyFor(token), JSON.stringify(data), 'EX', SESSION_TTL_SECONDS)
  return token
}

export async function readSession(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null
  const raw = await redis.get(keyFor(token))
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return
  await redis.del(keyFor(token))
}

/** Invalidate every session for a user — used on password change. */
export async function destroyAllSessionsFor(userId: string): Promise<void> {
  const stream = redis.scanStream({ match: 'session:*', count: 200 })
  for await (const keys of stream as AsyncIterable<string[]>) {
    if (keys.length === 0) continue
    const values = await redis.mget(...keys)
    const doomed = keys.filter((_, i) => {
      try {
        return values[i] && (JSON.parse(values[i]!) as SessionData).userId === userId
      } catch {
        return false
      }
    })
    if (doomed.length > 0) await redis.del(...doomed)
  }
}

/*
 * Hosting platforms that hand every project its own subdomain. Two projects
 * under one of these share their last two labels but are *different sites* to
 * the browser, so the registrable domain needs one label more than usual.
 * A full public-suffix list is overkill; these are the hosts in play.
 */
const PROJECT_SUBDOMAIN_SUFFIXES = [
  'up.railway.app',
  'vercel.app',
  'onrender.com',
  'netlify.app',
  'fly.dev',
  'pages.dev',
  'workers.dev',
  'herokuapp.com',
  'github.io',
]

/** The part of a hostname that decides same-site, e.g. `a.b.example.com` → `example.com`. */
function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0] ?? ''
  for (const suffix of PROJECT_SUBDOMAIN_SUFFIXES) {
    if (host === suffix) return host
    if (host.endsWith(`.${suffix}`)) {
      const project = host.slice(0, -(suffix.length + 1)).split('.').pop() ?? ''
      return `${project}.${suffix}`
    }
  }
  return host.split('.').slice(-2).join('.')
}

const siteDomain = (() => {
  try {
    return registrableDomain(new URL(env.SITE_URL).hostname)
  } catch {
    return null
  }
})()

/*
 * Cookie policy, derived per request rather than fixed.
 *
 * When the storefront and the API share a site (elegantsip.com and
 * api.elegantsip.com) `Lax` is right: it is sent on the payment gateway's
 * redirect back to the site, where `Strict` would drop the cookie and log the
 * customer out at the worst possible moment.
 *
 * When they are on different sites — a Vercel storefront calling a Railway API
 * — `Lax` is not merely stricter, it is *broken*: the browser withholds the
 * cookie from every cross-site fetch, so the customer signs in successfully and
 * is anonymous again on the next request. That case needs `None`, which the
 * spec only honours alongside `Secure`. CSRF is held off instead by the CORS
 * allowlist plus the preflight that every JSON request here triggers.
 */
export function sessionCookieOptions(hostname: string) {
  const crossSite = siteDomain !== null && registrableDomain(hostname) !== siteDomain
  return {
    httpOnly: true,
    sameSite: crossSite ? ('none' as const) : ('lax' as const),
    // `SameSite=None` without `Secure` is rejected outright by every browser.
    secure: isProduction || crossSite,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}

export async function pingRedis(): Promise<boolean> {
  try {
    return (await redis.ping()) === 'PONG'
  } catch {
    return false
  }
}
