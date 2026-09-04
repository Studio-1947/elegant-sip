import './dev-defaults.js'
import { buildApp } from './app.js'
import { env } from './env.js'
import { sql } from './db/client.js'
import { expirePendingOrders } from './routes/orders.js'

const app = await buildApp()

/*
 * Hosts without a pre-deploy step do this here instead. Seeding is safe to
 * repeat: every insert upserts, and the variant upsert leaves `stock` out of
 * its update set, so real inventory is never overwritten by the seed values.
 */
if (env.MIGRATE_ON_START) {
  app.log.info('MIGRATE_ON_START set — applying migrations before listening')
  const [{ runMigrations }, { seed }] = await Promise.all([
    import('./db/migrate.js'),
    import('./db/seed.js'),
  ])
  await runMigrations()
  await seed()
  app.log.info('database ready')
}

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

  const expireOrders = async () => {
    const cutoff = new Date(Date.now() - env.PENDING_PAYMENT_TTL_MINUTES * 60_000)
    try {
      const expired = await expirePendingOrders(cutoff)
      if (expired > 0) app.log.info({ expired }, 'expired pending-payment orders')
    } catch (err) {
      // A later interval retries; never let a maintenance task take checkout down.
      app.log.error({ err }, 'pending-payment expiry sweep failed')
    }
  }
  void expireOrders()
  const expiryTimer = setInterval(() => void expireOrders(), env.ORDER_EXPIRY_SWEEP_SECONDS * 1_000)
  expiryTimer.unref()
} catch (err) {
  app.log.error({ err }, 'failed to start')
  process.exit(1)
}
