/* ────────────────────────────────────────────────────────────────────────────
 * Responsive image variants.
 *
 * `npm run images:variants` writes a -640 and -1024 WebP beside each source
 * image listed here. `SkeletonImage` reads this list and builds the `srcset`
 * itself, so a phone never downloads a 2560px file to paint it 390px wide —
 * without every call site having to remember to pass one.
 *
 * To add an image: drop it in public/, add its basename here, re-run the
 * variant script. Anything not listed simply renders at its single size.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Basenames (no extension, no leading slash) that have -640 and -1024 variants. */
export const RESPONSIVE_IMAGES = new Set([
  'craft',
  'embercharm',
  'experience',
  'gopal',
  'harvest',
  'hero',
  'morningdew',
  'origin',
  'package',
  'shopimg',
  'summerbreeze',
  'tea1_1',
  'products/first-flush',
  'products/first-flush-leaf',
  'products/golden-needle',
  'products/golden-needle-leaf',
  'products/green-tea',
  'products/pan-roasted',
  'products/pan-roasted-leaf',
  'products/silver-needle',
  'products/silver-needle-leaf',
  'products/white-tea',
  'products/first-flush-pile',
  'products/golden-needle-alt',
  'products/golden-needle-pile',
  'products/green-tea-alt',
  'products/pan-roasted-alt',
  'products/pan-roasted-pile',
  'products/silver-needle-alt',
  'products/silver-needle-pile',
  'products/white-tea-alt',
  'products/second-flush',
  'products/third-flush',
  'products/whole-leaf-first-flush',
  'products/whole-leaf-second-flush',
  'products/whole-leaf-autumn-flush',
  'products/chamomile',
])

const WIDTHS = [640, 1024]

/**
 * Build a `srcset` for a public-folder image, or `undefined` when the image has
 * no generated variants. The original is offered as the largest candidate.
 */
export function buildSrcSet(src: string | undefined, intrinsicWidth?: number): string | undefined {
  if (!src || !src.startsWith('/') || !src.endsWith('.webp')) return undefined
  const base = src.slice(1, -'.webp'.length)
  // Already a variant (e.g. "/hero-1024.webp") — don't build a set from a set.
  if (/-\d+$/.test(base)) return undefined
  if (!RESPONSIVE_IMAGES.has(base)) return undefined

  const largest = intrinsicWidth && intrinsicWidth > 1024 ? intrinsicWidth : 2560
  return [...WIDTHS.map((w) => `/${base}-${w}.webp ${w}w`), `${src} ${largest}w`].join(', ')
}
