/*
 * Lighthouse scores for the built site.
 *
 * Uses the Chrome that Playwright already downloaded, so there is no separate
 * browser dependency. Run against `npm run serve:dist`.
 *
 * Usage: node scripts/lighthouse-run.mjs [baseUrl] [...paths]
 */
import { launch } from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2).filter((a) => a !== '--mobile')
/* Google indexes mobile-first, so `--mobile` is the profile that matters for
   ranking. Desktop stays the default because it isolates the site's own cost
   from the simulated 4x CPU slowdown. */
const MOBILE = process.argv.includes('--mobile')

const BASE = (args[0] ?? 'http://localhost:4500').replace(/\/$/, '')
const PATHS = args.slice(1).length
  ? args.slice(1)
  : ['/', '/shop', '/product/first-flush-whole-leaf', '/brewing', '/faq']

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

const chrome = await launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
})

mkdirSync('reports', { recursive: true })

const bar = (n) => {
  const filled = Math.round(n / 5)
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
}
const grade = (n) => (n >= 90 ? 'good' : n >= 50 ? 'needs work' : 'poor')

const rows = []
const allFailures = new Map()

for (const path of PATHS) {
  const url = BASE + path
  const runnerResult = await lighthouse(
    url,
    {
      port: chrome.port,
      output: 'html',
      logLevel: 'error',
      formFactor: MOBILE ? 'mobile' : 'desktop',
      screenEmulation: MOBILE
        ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
        : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      // Mobile uses Lighthouse's standard 4G + 4x CPU slowdown — the profile
      // Google's mobile-first indexing approximates. Desktop uses a fast
      // connection so the number reflects the build, not the throttle.
      throttling: MOBILE
        ? { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.5, uploadThroughputKbps: 675 }
        : { rttMs: 40, throughputKbps: 10 * 1024, cpuSlowdownMultiplier: 1 },
      onlyCategories: CATEGORIES,
    },
  )

  const lhr = runnerResult.lhr
  const scores = Object.fromEntries(
    CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)]),
  )
  rows.push({ path, scores, lhr })

  const profile = MOBILE ? 'mobile' : 'desktop'
  writeFileSync(
    `reports/lighthouse-${profile}${path === '/' ? '-home' : path.replace(/\//g, '-')}.html`,
    runnerResult.report,
  )

  // Collect every audit that did not pass, per category.
  for (const cat of CATEGORIES) {
    for (const ref of lhr.categories[cat]?.auditRefs ?? []) {
      const a = lhr.audits[ref.id]
      if (!a || a.score === null || a.score >= 0.9) continue
      if (ref.group === 'hidden') continue
      const key = `${cat}::${a.id}`
      if (!allFailures.has(key)) allFailures.set(key, { cat, title: a.title, score: a.score, display: a.displayValue, paths: [] })
      allFailures.get(key).paths.push(path)
    }
  }
}

// chrome-launcher's temp-dir cleanup throws EPERM on Windows while the browser
// is still releasing handles. The run is finished by this point, so a failure
// here must not swallow the report.
try {
  await chrome.kill()
} catch {
  /* temp dir left behind; the OS reclaims it */
}

/* ── Report ──────────────────────────────────────────────────────────────── */

console.log(`\nLIGHTHOUSE — ${MOBILE ? 'mobile (4G, 4x CPU slowdown)' : 'desktop'}, ${PATHS.length} pages\n${'='.repeat(72)}`)
console.log(`${'page'.padEnd(34)} ${'perf'.padStart(5)} ${'a11y'.padStart(5)} ${'best'.padStart(5)} ${'seo'.padStart(5)}`)
console.log('-'.repeat(72))
for (const { path, scores } of rows) {
  console.log(
    `${path.padEnd(34)} ${String(scores.performance).padStart(5)} ${String(scores.accessibility).padStart(5)} ${String(scores['best-practices']).padStart(5)} ${String(scores.seo).padStart(5)}`,
  )
}

const avg = (cat) => Math.round(rows.reduce((a, r) => a + r.scores[cat], 0) / rows.length)
console.log('-'.repeat(72))
console.log(`${'AVERAGE'.padEnd(34)} ${String(avg('performance')).padStart(5)} ${String(avg('accessibility')).padStart(5)} ${String(avg('best-practices')).padStart(5)} ${String(avg('seo')).padStart(5)}`)

console.log(`\n${'='.repeat(72)}`)
for (const cat of CATEGORIES) {
  const s = avg(cat)
  console.log(`${cat.padEnd(16)} ${bar(s)} ${String(s).padStart(3)}/100  ${grade(s)}`)
}

/* Core Web Vitals from the home page run. */
const home = rows[0].lhr
console.log(`\nCore Web Vitals (${rows[0].path}, simulated ${MOBILE ? 'mobile' : 'desktop'})`)
for (const id of ['largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'first-contentful-paint', 'speed-index']) {
  const a = home.audits[id]
  if (a) console.log(`  ${a.title.padEnd(30)} ${String(a.displayValue).padStart(10)}   ${a.score >= 0.9 ? 'good' : a.score >= 0.5 ? 'needs work' : 'poor'}`)
}

if (allFailures.size) {
  console.log(`\nAudits not passing (${allFailures.size})`)
  const sorted = [...allFailures.values()].sort((a, b) => a.cat.localeCompare(b.cat) || a.score - b.score)
  for (const f of sorted) {
    const where = f.paths.length === PATHS.length ? 'all pages' : f.paths.join(', ')
    console.log(`  [${f.cat}] ${f.title}${f.display ? ` — ${f.display}` : ''}`)
    console.log(`      ${where}`)
  }
} else {
  console.log('\nEvery scored audit passed.')
}

console.log(`\nFull HTML reports written to reports/`)
