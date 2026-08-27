/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { indexableRoutes, ROUTE_META, articleRouteMeta, productRouteMeta } from './src/lib/seoRoutes'
import { DEFAULT_OG_IMAGE, SITE_URL, absoluteUrl } from './src/lib/site'

/* ────────────────────────────────────────────────────────────────────────────
 * SEO build step.
 *
 * The app is a client-rendered SPA on a history router, so without this every
 * URL would serve the same <head> and crawlers would see one page. This plugin
 * writes, per indexable route, a static HTML shell carrying that route's real
 * title, description, canonical and Open Graph tags — then lets the SPA hydrate
 * the body as usual. It also generates sitemap.xml and robots.txt from the live
 * catalogue, so neither can drift from the products actually on sale.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Escape a string for inclusion in an HTML attribute or XML text node. */
const esc = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function metaForPath(path: string) {
  if (ROUTE_META[path]) return ROUTE_META[path]
  const [, section, id] = path.split('/')
  if (section === 'product' && id) return productRouteMeta(id)
  if (section === 'journal' && id) return articleRouteMeta(id)
  return undefined
}

/**
 * Replace one meta tag's content. Vite preserves the source formatting, so the
 * attribute may sit on the next line — the pattern has to tolerate arbitrary
 * whitespace between the name and `content`.
 */
function setMetaContent(html: string, attr: 'name' | 'property', key: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${key}"\\s+content=")[^"]*(")`, 'i')
  if (!pattern.test(html)) {
    throw new Error(`SEO prerender: no <meta ${attr}="${key}"> in index.html to rewrite`)
  }
  return html.replace(pattern, `$1${esc(value)}$2`)
}

/** Rewrite the built index.html head for one specific route. */
function shellForRoute(template: string, path: string): string {
  const meta = metaForPath(path)
  if (!meta) return template
  const canonical = absoluteUrl(path)
  const image = meta.image
    ? meta.image.startsWith('http')
      ? meta.image
      : absoluteUrl(meta.image)
    : DEFAULT_OG_IMAGE

  let html = template.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(meta.title)}</title>`)
  html = setMetaContent(html, 'name', 'description', meta.description)
  html = setMetaContent(html, 'property', 'og:title', meta.title)
  html = setMetaContent(html, 'property', 'og:description', meta.description)
  html = setMetaContent(html, 'property', 'og:url', canonical)
  html = setMetaContent(html, 'property', 'og:image', image)
  html = setMetaContent(html, 'name', 'twitter:title', meta.title)
  html = setMetaContent(html, 'name', 'twitter:description', meta.description)
  html = setMetaContent(html, 'name', 'twitter:image', image)
  html = setMetaContent(html, 'name', 'robots', meta.noindex ? 'noindex, follow' : 'index, follow')
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${esc(canonical)}$2`)
  return html
}

function seoPlugin(): Plugin {
  return {
    name: 'elegantsip-seo',
    apply: 'build',
    closeBundle() {
      const outDir = resolve(__dirname, 'dist')
      const template = readFileSync(resolve(outDir, 'index.html'), 'utf8')
      const routes = indexableRoutes()
      const today = new Date().toISOString().slice(0, 10)

      /* One static shell per indexable route (the root already exists). */
      let written = 0
      for (const { path } of routes) {
        if (path === '/') continue
        const file = resolve(outDir, `${path.slice(1)}/index.html`)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, shellForRoute(template, path), 'utf8')
        written += 1
      }
      /* The root shell gets the home metadata too. */
      writeFileSync(resolve(outDir, 'index.html'), shellForRoute(template, '/'), 'utf8')

      /* Sitemap, generated from the live catalogue. */
      const urls = routes
        .map(
          ({ path, priority, changefreq }) =>
            `  <url>\n    <loc>${esc(absoluteUrl(path))}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`,
        )
        .join('\n')
      writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        'utf8',
      )

      /* Robots: transactional routes stay out of the index. */
      writeFileSync(
        resolve(outDir, 'robots.txt'),
        [
          'User-agent: *',
          'Allow: /',
          'Disallow: /cart',
          'Disallow: /checkout',
          'Disallow: /account',
          'Disallow: /wishlist',
          'Disallow: /order/',
          '',
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          '',
        ].join('\n'),
        'utf8',
      )

      this.info(`SEO: ${written + 1} prerendered shells, ${routes.length} sitemap URLs`)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin()],
  test: {
    // Only this project's tests — the repo also holds unrelated local tooling.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  build: {
    rollupOptions: {
      output: {
        // Vendor code changes far less often than app code — splitting it keeps
        // the big, stable dependencies cached across app deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
          animation: ['gsap', 'gsap/ScrollTrigger', '@gsap/react', 'lenis'],
        },
      },
    },
  },
})
