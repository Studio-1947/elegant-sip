/*
 * Static server that mirrors public/.htaccess: directory index first, then a
 * real file, then the SPA fallback. `vite preview` skips the directory-index
 * step, so it would serve the root shell for every route and hide whether the
 * prerendered per-route HTML is actually correct.
 *
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const ROOT = resolve(process.cwd(), 'dist')
const PORT = Number(process.argv[2] ?? 4500)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
}

const isFile = (p) => existsSync(p) && statSync(p).isFile()

// Every real tea has a prerendered shell; any other /product/<slug> is a 404 (see Caddyfile).
const PRODUCT_PATH = /^\/product\/[^/]+\/?$/

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const candidates = [join(ROOT, pathname, 'index.html'), join(ROOT, pathname), join(ROOT, 'index.html')]
  for (const file of candidates) {
    if (!isFile(file)) continue
    const ext = extname(file)
    // Mirror the Cache-Control the shipped .htaccess sets. Without this a
    // Lighthouse run reports several MB of "inefficient cache lifetimes" that
    // production would not have, which makes the score misleading.
    const cache =
      ext === '.html'
        ? 'public, max-age=0, must-revalidate'
        : 'public, max-age=31536000, immutable'
    // The app shell for an unknown product still renders the in-app NotFound
    // page, but with a real 404 so crawlers do not index a soft 404.
    const unknownProduct = file === candidates[2] && PRODUCT_PATH.test(pathname)
    res.writeHead(unknownProduct ? 404 : 200, {
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': cache,
    })
    res.end(readFileSync(file))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`))
