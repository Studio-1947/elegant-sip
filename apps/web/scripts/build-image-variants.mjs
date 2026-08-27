/*
 * Regenerates the -640 and -1024 WebP variants that `src/lib/responsiveImages.ts`
 * advertises. Run after adding or replacing an image in public/.
 *
 * Requires ffmpeg on PATH (the project already depends on it for the scroll
 * videos — see the encoding recipe in README).
 *
 * Usage: node scripts/build-image-variants.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { RESPONSIVE_IMAGES } from '../src/lib/responsiveImages.ts'

const WIDTHS = [640, 1024]
const PUBLIC = resolve(process.cwd(), 'public')
const kb = (p) => Math.round(statSync(p).size / 1024)

let made = 0
for (const base of [...RESPONSIVE_IMAGES].sort()) {
  const source = resolve(PUBLIC, `${base}.webp`)
  if (!existsSync(source)) {
    console.warn(`  skip   ${base}.webp — not found`)
    continue
  }
  for (const w of WIDTHS) {
    const out = resolve(PUBLIC, `${base}-${w}.webp`)
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', source,
      // min() so a variant is never upscaled past its source.
      '-vf', `scale='min(${w},iw)':-2`,
      '-quality', '78',
      out,
    ])
    made += 1
  }
  console.log(
    `  ok     ${base}: ${kb(source)} KB → ${WIDTHS.map((w) => `${kb(resolve(PUBLIC, `${base}-${w}.webp`))} KB @${w}`).join(', ')}`,
  )
}
console.log(`\n${made} variants written to public/`)
