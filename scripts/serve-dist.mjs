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

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  const candidates = [join(ROOT, pathname, 'index.html'), join(ROOT, pathname), join(ROOT, 'index.html')]
  for (const file of candidates) {
    if (!isFile(file)) continue
    // A SPA-fallback hit is a real 404 for anything that isn't an app route,
    // but the shell still renders the in-app NotFound page.
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
    return
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, () => console.log(`serving dist/ on http://localhost:${PORT}`))
