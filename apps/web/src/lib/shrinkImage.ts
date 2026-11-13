/* ────────────────────────────────────────────────────────────────────────────
 * Shrink a photo in the browser before it is uploaded.
 *
 * The API re-encodes every upload to WebP at most 2048px wide, so anything
 * bigger is wasted bandwidth. It also has to fit through the reverse proxy in
 * front of the site: the production nginx refused bodies over 1 MB, so most
 * phone and camera photos failed with an opaque "413" before reaching the API.
 * Resizing here keeps uploads small and fast whatever the proxy allows.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Matches the API's own cap, so nothing is lost by resizing here. */
const MAX_EDGE = 2048
/** Comfortably under nginx's default 1 MB request limit. */
export const TARGET_BYTES = 900 * 1024

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Returns the file unchanged when it is already small enough, otherwise a
 * resized WebP (JPEG where the browser cannot write WebP) under TARGET_BYTES.
 * If the browser cannot decode the file, the original is returned and the API
 * gives its own clear answer.
 */
export async function shrinkImage(file: File): Promise<File> {
  if (file.size <= TARGET_BYTES) return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    let scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // Try a few qualities, then smaller sizes, until the file fits.
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      for (const quality of [0.86, 0.78, 0.7]) {
        const blob = (await toBlob(canvas, 'image/webp', quality)) ?? (await toBlob(canvas, 'image/jpeg', quality))
        if (blob && blob.size <= TARGET_BYTES) {
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
          return new File([blob], file.name.replace(/\.[^.]+$/, '') + `.${ext}`, { type: blob.type })
        }
      }
      scale *= 0.8
    }
    return file
  } finally {
    bitmap.close()
  }
}
