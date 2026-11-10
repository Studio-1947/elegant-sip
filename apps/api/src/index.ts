import './dev-defaults.js'
import { buildApp } from './app.js'
import { emailConfigIssues, env } from './env.js'
import { sql } from './db/client.js'
import { expirePendingOrders } from './routes/orders.js'
import { syncStaleShipments } from './lib/fulfilment.js'
import { startWatchdog } from './lib/watchdog.js'

const app = await buildApp()

for (const issue of emailConfigIssues(env, process.env.MAIL_FROM)) app.log[issue.level](issue.message)

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
      const expired = await expirePendingOrders(cutoff, app.log)
      if (expired > 0) app.log.info({ expired }, 'expired pending-payment orders')
    } catch (err) {
      // A later interval retries; never let a maintenance task take checkout down.
      app.log.error({ err }, 'pending-payment expiry sweep failed')
    }
  }
  void expireOrders()
  const expiryTimer = setInterval(() => void expireOrders(), env.ORDER_EXPIRY_SWEEP_SECONDS * 1_000)
  expiryTimer.unref()

  if (env.SHIPMENT_SYNC_MINUTES > 0 && env.SHIPPING_PROVIDER !== 'manual') {
    const syncShipments = async () => {
      try {
        const synced = await syncStaleShipments(env.SHIPMENT_SYNC_MINUTES, app.log)
        if (synced > 0) app.log.info({ synced }, 'refreshed courier tracking')
      } catch (err) {
        app.log.error({ err }, 'background shipment sync failed')
      }
    }
    // Check every quarter of the window so no parcel waits much longer than it.
    const interval = Math.max(5, Math.round(env.SHIPMENT_SYNC_MINUTES / 4)) * 60_000
    const shipmentTimer = setInterval(() => void syncShipments(), interval)
    shipmentTimer.unref()
  }

  if (env.NODE_ENV === 'production' && env.WATCHDOG_MINUTES > 0) {
    startWatchdog({
      minutes: env.WATCHDOG_MINUTES,
      statusDir: env.OPS_STATUS_DIR,
      diskAlertPercent: env.DISK_ALERT_PERCENT,
      log: app.log,
    }).unref()
  }
} catch (err) {
  app.log.error({ err }, 'failed to start')
  process.exit(1)
}
