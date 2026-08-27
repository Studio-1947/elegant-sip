import { buildApp } from './app.js'
import { env } from './env.js'
import { sql } from './db/client.js'

const app = await buildApp()

/* Drain in-flight requests before exiting so a deploy never severs a payment. */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down')
    void app
      .close()
      .then(() => sql.end({ timeout: 5 }))
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error({ err }, 'error during shutdown')
        process.exit(1)
      })
  })
}

try {
  await app.listen({ port: env.PORT, host: env.HOST })
  app.log.info(`docs: http://localhost:${env.PORT}/docs`)
} catch (err) {
  app.log.error({ err }, 'failed to start')
  process.exit(1)
}
