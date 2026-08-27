import type { SessionData } from './lib/sessions.js'

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Populated by the session hook in app.ts on every request; null when the
     * caller is anonymous. Routes use requireUser()/requireAdmin() rather than
     * reading this directly when authentication is mandatory.
     */
    session: SessionData | null
  }
}
