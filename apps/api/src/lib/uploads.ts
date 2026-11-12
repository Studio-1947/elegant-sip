import { randomBytes } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { env } from '../env.js'

/* ────────────────────────────────────────────────────────────────────────────
 * Product photos uploaded in the admin.
 *
 * Every upload is re-encoded, never stored as sent: the photo is turned the
 * right way up (phone EXIF), capped at 2048px, saved as WebP, and given the
 * -640 and -1024 sizes the storefront's srcset expects. Re-encoding also strips
 * metadata (GPS from a phone camera) and rejects anything that is not really an
 * image. Names are random, so a URL never changes meaning and can be cached
 * forever.
 * ──────────────────────────────────────────────────────────────────────────── */

export const UPLOAD_PUBLIC_PREFIX = '/uploads/products/'
export const UPLOAD_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const MAX_WIDTH = 2048
const WIDTHS = [640, 1024] as const

/** A stored file name: id, optional size suffix, .webp. Nothing else is ever served. */
export const STORED_NAME = /^[a-z0-9]{8,40}(-640|-1024)?\.webp$/

export const productUploadsDir = () => resolve(env.UPLOADS_DIR, 'products')

export class NotAnImageError extends Error {}

export async function saveProductPhoto(input: Buffer): Promise<{ src: string; width: number; height: number }> {
  let meta: sharp.Metadata
  try {
    meta = await sharp(input).metadata()
  } catch {
    throw new NotAnImageError('That file is not a photo we can read. Use JPG, PNG, WebP or AVIF.')
  }
  if (!meta.width || !meta.height) throw new NotAnImageError('That photo has no size information.')

  const id = `${Date.now().toString(36)}${randomBytes(6).toString('hex')}`
  const dir = productUploadsDir()
  await mkdir(dir, { recursive: true })

  const base = sharp(input).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true })
  const full = await base.clone().webp({ quality: 82 }).toBuffer({ resolveWithObject: true })
  await writeFile(resolve(dir, `${id}.webp`), full.data)

  for (const width of WIDTHS) {
    const out = await base.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
    await writeFile(resolve(dir, `${id}-${width}.webp`), out)
  }

  return { src: `${UPLOAD_PUBLIC_PREFIX}${id}.webp`, width: full.info.width, height: full.info.height }
}
