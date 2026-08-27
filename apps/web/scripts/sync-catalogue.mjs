/*
 * Pulls the catalogue from the API into a committed JSON snapshot.
 *
 *   npm run catalogue:sync --workspace @elegantsip/web
 *
 * WHY A SNAPSHOT RATHER THAN A RUNTIME FETCH
 *
 * The catalogue is six products that change a few times a year. Baking it into
 * the bundle means the shop grid paints instantly with no spinner, the
 * prerendered HTML carries real product data for crawlers, and the sitemap can
 * be generated at build time — which is exactly what the SEO pipeline needs.
 *
 * Prices and stock can therefore be slightly stale. That is safe because
 * nothing monetary is ever decided from this file: the server re-prices every
 * cart at /v1/pricing/quote and again at /v1/orders, and returns `adjustments`
 * when a line has moved. The snapshot is for display and routing only.
 *
 * If the API is unreachable the previous snapshot is kept and the script exits
 * 0, so a deploy is never blocked by the API being briefly down.
 */
import { writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const API = (process.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')
const OUT = resolve(process.cwd(), 'src/data/catalogue.json')

const get = async (path) => {
  const res = await fetch(`${API}${path}`, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) throw new Error(`${path} → ${res.status}`)
  return res.json()
}

try {
  const [{ products }, { gardens }, { posts }] = await Promise.all([
    get('/v1/products'),
    get('/v1/gardens'),
    get('/v1/journal'),
  ])

  if (!products?.length) throw new Error('API returned an empty catalogue — refusing to write it')

  const snapshot = {
    syncedAt: new Date().toISOString(),
    source: API,
    products,
    gardens,
    journal: posts,
  }

  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  console.log(
    `catalogue synced from ${API}\n  ${products.length} products · ${gardens.length} gardens · ${posts.length} journal posts`,
  )
} catch (error) {
  if (existsSync(OUT)) {
    console.warn(`catalogue sync skipped (${error.message}) — keeping the existing snapshot`)
    process.exit(0)
  }
  console.error(`catalogue sync failed and there is no existing snapshot: ${error.message}`)
  process.exit(1)
}
