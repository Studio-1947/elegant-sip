import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hasZodFastifySchemaValidationErrors, isResponseSerializationError } from 'fastify-type-provider-zod'
import type { Problem } from '@elegantsip/shared'
import { isProduction } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * One error shape for the entire API (RFC 9457-style).
 *
 * Two rules hold everywhere:
 *   · `detail` is always safe to show a customer. Internal causes go to the
 *     logs under `requestId` and never into the response body.
 *   · Every response carries `requestId`, so a support conversation can be
 *     tied to an exact log line.
 * ──────────────────────────────────────────────────────────────────────────── */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly type: string,
    readonly title: string,
    readonly detail: string,
    readonly errors?: Record<string, string[]>,
  ) {
    super(detail)
    this.name = 'ApiError'
  }

  static notFound(what: string) {
    return new ApiError(404, 'not_found', 'Not found', `${what} could not be found.`)
  }

  static badRequest(detail: string, errors?: Record<string, string[]>) {
    return new ApiError(400, 'bad_request', 'Bad request', detail, errors)
  }

  static conflict(type: string, detail: string) {
    return new ApiError(409, type, 'Conflict', detail)
  }
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    const problem: Problem = {
      type: 'not_found',
      title: 'Not found',
      status: 404,
      detail: `No route matches ${request.method} ${request.url}.`,
      requestId: request.id,
    }
    reply.status(404).send(problem)
  })

  app.setErrorHandler((error: FastifyError, request, reply) => {
    // Request body/params/query failed schema validation — report per field so
    // the storefront can attach messages to the inputs that caused them.
    if (hasZodFastifySchemaValidationErrors(error)) {
      const errors: Record<string, string[]> = {}
      for (const item of error.validation) {
        // fastify-type-provider-zod reports a JSON-pointer instancePath
        // ("/items/0/quantity"); the storefront wants a dotted field path.
        const path = (item.instancePath ?? '').replace(/^\//, '').replace(/\//g, '.') || '(root)'
        ;(errors[path] ??= []).push(item.message ?? 'Invalid value')
      }
      request.log.info({ errors }, 'request validation failed')
      const problem: Problem = {
        type: 'validation_error',
        title: 'Invalid request',
        status: 400,
        detail: 'Some fields need attention before this request can be processed.',
        errors,
        requestId: request.id,
      }
      return reply.status(400).send(problem)
    }

    // The handler returned something its own schema forbids. That is our bug,
    // never the caller's — log loudly, tell the client nothing specific.
    if (isResponseSerializationError(error)) {
      request.log.error({ err: error, route: error.method + ' ' + error.url }, 'response failed its own schema')
      const problem: Problem = {
        type: 'internal_error',
        title: 'Internal error',
        status: 500,
        detail: 'Something went wrong on our side. The team has been notified.',
        requestId: request.id,
      }
      return reply.status(500).send(problem)
    }

    if (error instanceof ApiError) {
      request.log.info({ type: error.type, status: error.status }, error.detail)
      const problem: Problem = {
        type: error.type,
        title: error.title,
        status: error.status,
        detail: error.detail,
        ...(error.errors ? { errors: error.errors } : {}),
        requestId: request.id,
      }
      return reply.status(error.status).send(problem)
    }

    // Rate limiting and other Fastify-native errors carry their own status.
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
    if (status >= 500) request.log.error({ err: error }, 'unhandled error')
    else request.log.info({ err: error }, 'request rejected')

    const problem: Problem = {
      type: status === 429 ? 'rate_limited' : status >= 500 ? 'internal_error' : 'bad_request',
      title: status >= 500 ? 'Internal error' : 'Request rejected',
      status,
      detail:
        status >= 500 && isProduction
          ? 'Something went wrong on our side. The team has been notified.'
          : error.message,
      requestId: request.id,
    }
    return reply.status(status).send(problem)
  })
}
