import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { limit } from './auth-shared.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Content-Security-Policy violation reports.
 *
 * Browsers post here when the storefront's CSP (set by Caddy) blocks
 * something, so a policy that breaks checkout shows up in the logs rather than
 * as a silent drop in orders. Two formats arrive:
 *
 *   · `application/csp-report` — the legacy `report-uri` body,
 *     `{ "csp-report": { "blocked-uri": …, … } }`;
 *   · `application/reports+json` — the Reporting API (`report-to`), an array
 *     of `{ type: "csp-violation", body: { blockedURL: …, … } }`.
 *
 * Anyone can post anything here, so the log line keeps a fixed handful of
 * fields and drops every query string: report URLs routinely carry tokens,
 * order references and other things that do not belong in logs.
 * ──────────────────────────────────────────────────────────────────────────── */

const MAX_BODY_BYTES = 16 * 1024
/** A burst of reports in one delivery is logged up to this many. */
const MAX_REPORTS = 20

interface Violation {
  directive?: string
  blocked?: string
  document?: string
  source?: string
  line?: number
}

const text = (value: unknown, max = 200) => (typeof value === 'string' && value !== '' ? value.slice(0, max) : undefined)

/** Origin and path only (or just the path). Non-web schemes keep only the scheme. */
function withoutQuery(value: unknown, pathOnly = false): string | undefined {
  const raw = text(value, 2_000)
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol)) return url.protocol // data:, blob:, extensions
    return (pathOnly ? url.pathname : url.origin + url.pathname).slice(0, 200)
  } catch {
    // Not absolute: a CSP keyword ("inline", "eval") or a bare path.
    return text(raw.split(/[?#]/, 1)[0])
  }
}

const lineOf = (value: unknown) => {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : undefined
}

// Older browsers send the whole policy clause ("script-src 'self'") as the directive.
const directiveOf = (value: unknown) => text(value)?.split(/\s/, 1)[0]

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function violationsIn(body: unknown): Violation[] {
  if (isObject(body) && isObject(body['csp-report'])) {
    const r = body['csp-report']
    return [
      {
        directive: directiveOf(r['effective-directive'] ?? r['violated-directive']),
        blocked: withoutQuery(r['blocked-uri']),
        document: withoutQuery(r['document-uri'], true),
        source: withoutQuery(r['source-file']),
        line: lineOf(r['line-number']),
      },
    ]
  }
  if (Array.isArray(body)) {
    return body
      .filter((report): report is { type: string; body: Record<string, unknown> } =>
        isObject(report) && report.type === 'csp-violation' && isObject(report.body),
      )
      .map(({ body: r }) => ({
        directive: directiveOf(r.effectiveDirective ?? r.violatedDirective),
        blocked: withoutQuery(r.blockedURL),
        document: withoutQuery(r.documentURL, true),
        source: withoutQuery(r.sourceFile),
        line: lineOf(r.lineNumber),
      }))
  }
  return []
}

export const cspReportRoutes: FastifyPluginAsyncZod = async (app) => {
  // Fastify parses neither type by default. Scoped to this plugin, so no other
  // route starts accepting them. Malformed JSON is ignored, not an error: the
  // sender is a browser that will not read the answer.
  app.addContentTypeParser(
    ['application/csp-report', 'application/reports+json'],
    { parseAs: 'string', bodyLimit: MAX_BODY_BYTES },
    (_request, body, done) => {
      try {
        done(null, JSON.parse(body as string))
      } catch {
        done(null, null)
      }
    },
  )

  app.post(
    '/csp-report',
    {
      bodyLimit: MAX_BODY_BYTES,
      config: limit(60, '1 minute'),
      schema: {
        tags: ['Reports'],
        summary: 'Content-Security-Policy violation report',
        description: [
          'Sent by browsers, not called by the storefront. Accepts `application/csp-report`',
          '(report-uri) and `application/reports+json` (Reporting API). Always 204; bodies',
          'over 16 KB are rejected with 413.',
        ].join('\n'),
        response: { 204: z.null().describe('Received') },
      },
    },
    async (request, reply) => {
      for (const violation of violationsIn(request.body).slice(0, MAX_REPORTS)) {
        request.log.warn({ csp: violation }, 'csp violation')
      }
      return reply.status(204).send(null)
    },
  )
}
