/*
 * SEO audit — crawls the built site and checks what a crawler would actually
 * see. Run against `node scripts/serve-dist.mjs`, which resolves directory
 * indexes the way the shipped .htaccess does.
 *
 * Two passes per URL:
 *   RAW   — the served HTML, no JavaScript. This is what a crawler gets on
 *           first fetch and what the prerendered shells are for.
 *   HYDRATED — after React mounts, for JSON-LD and heading structure.
 *
 * Usage: node scripts/seo-check.mjs [baseUrl]
 */
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const BASE = (process.argv[2] ?? 'http://localhost:4500').replace(/\/$/, '')
const PROD_ORIGIN = 'https://elegantsip.in'

const results = []
const add = (level, area, message) => results.push({ level, area, message })
const fail = (area, m) => add('FAIL', area, m)
const warn = (area, m) => add('WARN', area, m)
const pass = (area, m) => add('PASS', area, m)

/* ── Sitemap is the crawl seed ───────────────────────────────────────────── */

const sitemapXml = readFileSync('dist/sitemap.xml', 'utf8')
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
const paths = sitemapUrls.map((u) => new URL(u).pathname)

if (sitemapUrls.length === 0) fail('sitemap', 'no <loc> entries')
else pass('sitemap', `${sitemapUrls.length} URLs`)

if (new Set(sitemapUrls).size !== sitemapUrls.length) fail('sitemap', 'duplicate <loc> entries')
if (sitemapUrls.some((u) => u.includes('#'))) fail('sitemap', 'contains hash-fragment URLs')
if (!/<lastmod>/.test(sitemapXml)) warn('sitemap', 'no <lastmod>')
if (sitemapUrls.some((u) => !u.startsWith(PROD_ORIGIN))) fail('sitemap', 'URL not on the production origin')

/* ── robots.txt ──────────────────────────────────────────────────────────── */

const robots = readFileSync('dist/robots.txt', 'utf8')
if (!robots.includes(`Sitemap: ${PROD_ORIGIN}/sitemap.xml`)) fail('robots', 'no absolute Sitemap: directive')
else pass('robots', 'declares the sitemap')
for (const p of ['/cart', '/checkout', '/account', '/wishlist']) {
  if (!robots.includes(`Disallow: ${p}`)) warn('robots', `${p} not disallowed`)
}
if (/Disallow: \/\s*$/m.test(robots)) fail('robots', 'blanket Disallow: / would deindex the whole site')

/* ── Crawl ───────────────────────────────────────────────────────────────── */

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

const titles = new Map()
const descriptions = new Map()
const pageData = []
const consoleErrors = []

for (const path of paths) {
  const url = BASE + path

  /* RAW: what a crawler sees before executing any JavaScript. */
  const raw = await fetch(url).then((r) => r.text())
  const rawTitle = raw.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()
  const rawDesc = raw.match(/<meta\s+name="description"\s+content="([^"]*)"/)?.[1]
  const rawCanonical = raw.match(/<link rel="canonical" href="([^"]*)"/)?.[1]
  const rawRobots = raw.match(/<meta\s+name="robots"\s+content="([^"]*)"/)?.[1]
  const rawOgImage = raw.match(/<meta\s+property="og:image"\s+content="([^"]*)"/)?.[1]
  const rawOgTitle = raw.match(/<meta\s+property="og:title"\s+content="([^"]*)"/)?.[1]

  /* HYDRATED: JSON-LD and headings come from React. */
  const page = await ctx.newPage()
  page.on('pageerror', (e) => consoleErrors.push(`${path}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${path}: ${m.text()}`) })
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 })
  await page.waitForTimeout(1200)

  const headings = await page.$$eval('h1,h2,h3,h4,h5,h6', (els) =>
    els.map((e) => ({ level: Number(e.tagName[1]), text: e.textContent.trim().slice(0, 60) })),
  )
  const jsonld = await page.$$eval('script[type="application/ld+json"]', (els) =>
    els.map((e) => e.textContent),
  )
  const images = await page.$$eval('img', (els) =>
    els.map((e) => ({
      src: e.getAttribute('src') ?? '',
      alt: e.getAttribute('alt'),
      hasDims: Boolean(e.getAttribute('width') && e.getAttribute('height')),
      srcset: Boolean(e.getAttribute('srcset')),
    })),
  )
  const links = await page.$$eval('a[href^="/"]', (els) => els.map((e) => e.getAttribute('href')))
  await page.close()

  pageData.push({ path, rawTitle, rawDesc, rawCanonical, rawRobots, rawOgImage, rawOgTitle, headings, jsonld, images, links })

  /* Per-page assertions. */
  const noindex = rawRobots?.includes('noindex')

  if (!rawTitle) fail('title', `${path} — missing`)
  else {
    if (rawTitle.length > 60) warn('title', `${path} — ${rawTitle.length} chars, may truncate in SERPs`)
    if (rawTitle.length < 15) warn('title', `${path} — only ${rawTitle.length} chars`)
    if (rawTitle.includes('  ')) fail('title', `${path} — double space (stripped separator)`)
    const prev = titles.get(rawTitle)
    if (prev) fail('title', `duplicate title on ${prev} and ${path}`)
    titles.set(rawTitle, path)
  }

  if (!rawDesc) fail('description', `${path} — missing`)
  else {
    if (rawDesc.length > 160) warn('description', `${path} — ${rawDesc.length} chars, may truncate`)
    if (rawDesc.length < 50) warn('description', `${path} — only ${rawDesc.length} chars`)
    const prev = descriptions.get(rawDesc)
    if (prev) fail('description', `duplicate description on ${prev} and ${path}`)
    descriptions.set(rawDesc, path)
  }

  const expected = PROD_ORIGIN + path
  if (!rawCanonical) fail('canonical', `${path} — missing`)
  else if (rawCanonical !== expected) fail('canonical', `${path} — points at ${rawCanonical}`)

  if (!rawRobots) warn('robots-meta', `${path} — no robots meta`)
  if (!noindex && rawRobots && !rawRobots.includes('index')) warn('robots-meta', `${path} — "${rawRobots}"`)

  if (!rawOgTitle || rawOgTitle !== rawTitle) fail('opengraph', `${path} — og:title does not match <title>`)
  if (!rawOgImage?.startsWith('http')) fail('opengraph', `${path} — og:image is not absolute`)

  const h1s = headings.filter((h) => h.level === 1)
  if (h1s.length === 0) fail('headings', `${path} — no <h1>`)
  else if (h1s.length > 1) fail('headings', `${path} — ${h1s.length} <h1> elements`)

  // Heading levels must not skip (h1 → h3).
  let prevLevel = 0
  for (const h of headings) {
    if (prevLevel && h.level > prevLevel + 1) {
      warn('headings', `${path} — h${prevLevel} → h${h.level} ("${h.text}")`)
      break
    }
    prevLevel = h.level
  }

  for (const raw of jsonld) {
    try { JSON.parse(raw) } catch { fail('jsonld', `${path} — invalid JSON`) }
  }

  const missingAlt = images.filter((i) => i.alt === null)
  if (missingAlt.length) fail('images', `${path} — ${missingAlt.length} <img> with no alt attribute`)
  const noDims = images.filter((i) => !i.hasDims)
  if (noDims.length) warn('images', `${path} — ${noDims.length}/${images.length} <img> without width/height (CLS)`)
}

/* ── Structured-data validation ──────────────────────────────────────────── */

const REQUIRED = {
  // `offers` is deliberately NOT required here. schema.org does not require it,
  // and coming-soon products have no price — emitting a ₹0 offer to satisfy
  // Google's rich-result guidance would be a false price. Those pages are
  // correctly not rich-result eligible; see the purchasable check below.
  Product: ['name', 'description', 'image'],
  Offer: ['price', 'priceCurrency', 'availability'],
  AggregateOffer: ['lowPrice', 'priceCurrency'],
  BreadcrumbList: ['itemListElement'],
  FAQPage: ['mainEntity'],
  HowTo: ['name', 'step'],
  BlogPosting: ['headline', 'datePublished', 'author'],
  Blog: ['name'],
  CollectionPage: ['name'],
  Organization: ['name', 'url'],
  OnlineStore: ['name', 'url'],
  WebSite: ['name', 'url'],
}

/* Which product pages legitimately have no price — read from the catalogue
   snapshot the build itself used, so the checker cannot disagree with the data
   that shipped. */
const catalogue = JSON.parse(readFileSync('src/data/catalogue.json', 'utf8'))
const comingSoonPaths = new Set(
  catalogue.products
    .filter((p) => p.status === 'coming-soon')
    .map((p) => `/product/${p.slug}`),
)

const typesSeen = new Set()
for (const { path, jsonld } of pageData) {
  for (const raw of jsonld) {
    let d
    try { d = JSON.parse(raw) } catch { continue }
    const type = d['@type']
    if (!type) { fail('jsonld', `${path} — block with no @type`); continue }
    typesSeen.add(type)
    if (!d['@context']) fail('jsonld', `${path} — ${type} has no @context`)
    for (const field of REQUIRED[type] ?? []) {
      if (d[field] === undefined) fail('jsonld', `${path} — ${type} missing "${field}"`)
    }
    if (type === 'Product') {
      if (!d.brand) warn('jsonld', `${path} — Product has no brand`)
      if (!d.sku) warn('jsonld', `${path} — Product has no sku`)
      // A product with no offers is only acceptable when it genuinely has no
      // price yet. If the page shows a price, the schema must carry one too.
      if (!d.offers) {
        const comingSoon = comingSoonPaths.has(path)
        if (comingSoon) pass('jsonld', `${path} — no offers (coming-soon: correct, not rich-result eligible)`)
        else fail('jsonld', `${path} — purchasable Product with no offers`)
      }
      if (typeof d.image === 'string' && !d.image.startsWith('http')) fail('jsonld', `${path} — Product image is relative`)
      if (Array.isArray(d.image) && d.image.some((i) => !i.startsWith('http'))) fail('jsonld', `${path} — Product image is relative`)
      const offers = d.offers?.offers ?? (Array.isArray(d.offers) ? d.offers : [d.offers]).filter(Boolean)
      for (const o of offers) {
        if (!o.availability?.startsWith('https://schema.org/')) fail('jsonld', `${path} — offer availability is not a schema.org enum`)
        if (typeof o.price !== 'number') fail('jsonld', `${path} — offer price is not numeric`)
      }
      // aggregateRating must never be asserted without reviews behind it.
      if (d.aggregateRating && !(d.aggregateRating.reviewCount > 0)) {
        fail('jsonld', `${path} — aggregateRating with no reviewCount`)
      }
    }
    if (type === 'BlogPosting' && d.datePublished && !/^\d{4}-\d{2}-\d{2}/.test(d.datePublished)) {
      fail('jsonld', `${path} — datePublished "${d.datePublished}" is not ISO 8601`)
    }
    if (type === 'BreadcrumbList') {
      const positions = d.itemListElement.map((i) => i.position)
      if (positions.some((p, i) => p !== i + 1)) fail('jsonld', `${path} — breadcrumb positions are not 1..n`)
    }
  }
}

/* ── Internal linking / orphans ──────────────────────────────────────────── */

const linkedTo = new Set()
for (const { links } of pageData) {
  for (const href of links) linkedTo.add(href.split('?')[0].replace(/\/$/, '') || '/')
}
const orphans = paths.filter((p) => !linkedTo.has(p === '/' ? '/' : p.replace(/\/$/, '')))
if (orphans.length) warn('linking', `not linked from any crawled page: ${orphans.join(', ')}`)
else pass('linking', 'every sitemap URL is internally linked')

/* ── Keyword presence on commercial pages ────────────────────────────────── */

for (const { path, rawTitle, rawDesc } of pageData) {
  if (!['/', '/shop'].includes(path) && !path.startsWith('/product/')) continue
  const blob = `${rawTitle} ${rawDesc}`.toLowerCase()
  if (!blob.includes('darjeeling')) warn('keywords', `${path} — "Darjeeling" absent from title+description`)
}

/* ── Report ──────────────────────────────────────────────────────────────── */

await browser.close()

const byLevel = { FAIL: [], WARN: [], PASS: [] }
for (const r of results) byLevel[r.level].push(r)

console.log(`\nSEO CHECK — ${paths.length} URLs crawled at ${BASE}\n${'='.repeat(64)}`)
for (const level of ['FAIL', 'WARN']) {
  if (!byLevel[level].length) continue
  console.log(`\n${level} (${byLevel[level].length})`)
  for (const r of byLevel[level]) console.log(`  [${r.area}] ${r.message}`)
}
console.log(`\nStructured-data types found: ${[...typesSeen].sort().join(', ')}`)
console.log(`Console errors during crawl: ${consoleErrors.length || 'none'}`)
for (const e of consoleErrors.slice(0, 5)) console.log(`  ${e}`)
console.log(`\n${'='.repeat(64)}`)
console.log(`${byLevel.FAIL.length} failures · ${byLevel.WARN.length} warnings`)

process.exit(byLevel.FAIL.length ? 1 : 0)
