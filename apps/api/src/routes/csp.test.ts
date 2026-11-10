import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { sql } from '../db/client.js'
import { redis } from '../lib/sessions.js'
import { violationsIn } from './csp.js'

/* CSP reports: both browser formats, nothing sensitive logged, always a quiet 204. */

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
  await sql.end({ timeout: 5 }).catch(() => {})
  await redis.quit().catch(() => {})
})

const legacy = {
  'csp-report': {
    'document-uri': 'https://elegantsip.in/orders/abc?token=secret#top',
    referrer: 'https://elegantsip.in/?ref=private',
    'violated-directive': "script-src-elem 'self'",
    'effective-directive': 'script-src-elem',
    'original-policy': "default-src 'self'; report-uri /api/v1/csp-report",
    'blocked-uri': 'https://evil.example/x.js?session=abc123',
    'source-file': 'https://elegantsip.in/assets/index.js?v=9',
    'line-number': 42,
    'status-code': 200,
  },
}

const reportingApi = [
  {
    type: 'csp-violation',
    age: 10,
    url: 'https://elegantsip.in/checkout?coupon=FRIEND',
    user_agent: 'Mozilla/5.0',
    body: {
      documentURL: 'https://elegantsip.in/checkout?coupon=FRIEND',
      effectiveDirective: 'img-src',
      blockedURL: 'https://tracker.example/pixel.gif?uid=42',
      disposition: 'enforce',
      sourceFile: 'https://elegantsip.in/assets/app.js',
      lineNumber: '7',
    },
  },
  { type: 'deprecation', body: { id: 'x', message: 'ignored' } },
  { type: 'csp-violation', body: { effectiveDirective: 'script-src', blockedURL: 'inline', documentURL: 'https://elegantsip.in/' } },
]

const post = (contentType: string, payload: string) =>
  app.inject({ method: 'POST', url: '/v1/csp-report', headers: { 'content-type': contentType }, payload })

describe('POST /v1/csp-report', () => {
  it('accepts the legacy report-uri format', async () => {
    const res = await post('application/csp-report', JSON.stringify(legacy))
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })

  it('accepts the Reporting API format', async () => {
    const res = await post('application/reports+json', JSON.stringify(reportingApi))
    expect(res.statusCode).toBe(204)
    expect(res.body).toBe('')
  })

  it('answers 204 to garbage too', async () => {
    expect((await post('application/csp-report', '{not json')).statusCode).toBe(204)
    expect((await post('application/reports+json', '"a string"')).statusCode).toBe(204)
  })

  it('rejects bodies over 16 KB', async () => {
    const huge = JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(17 * 1024) } })
    expect((await post('application/csp-report', huge)).statusCode).toBe(413)
    expect((await post('application/reports+json', `[${huge}]`)).statusCode).toBe(413)
  })
})

describe('violationsIn', () => {
  it('keeps only the agreed fields from a legacy report, with query strings stripped', () => {
    expect(violationsIn(legacy)).toEqual([
      {
        directive: 'script-src-elem',
        blocked: 'https://evil.example/x.js',
        document: '/orders/abc',
        source: 'https://elegantsip.in/assets/index.js',
        line: 42,
      },
    ])
  })

  it('reads only csp-violation entries from a Reporting API batch', () => {
    expect(violationsIn(reportingApi)).toEqual([
      {
        directive: 'img-src',
        blocked: 'https://tracker.example/pixel.gif',
        document: '/checkout',
        source: 'https://elegantsip.in/assets/app.js',
        line: 7,
      },
      { directive: 'script-src', blocked: 'inline', document: '/', source: undefined, line: undefined },
    ])
  })

  it('falls back to the first word of violated-directive and reduces data: URIs to their scheme', () => {
    const [v] = violationsIn({ 'csp-report': { 'violated-directive': "style-src 'self'", 'blocked-uri': 'data:text/css;base64,AAAA', 'document-uri': 'about:blank' } })
    expect(v.directive).toBe('style-src')
    expect(v.blocked).toBe('data:')
    expect(JSON.stringify(violationsIn({ 'csp-report': { 'blocked-uri': 'relative/path?x=secret' } }))).not.toContain('secret')
  })

  it('ignores anything else', () => {
    expect(violationsIn(null)).toEqual([])
    expect(violationsIn({ hello: 'world' })).toEqual([])
    expect(violationsIn('csp-report')).toEqual([])
  })
})
