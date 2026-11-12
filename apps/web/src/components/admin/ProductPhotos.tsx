import { useRef, useState, type CSSProperties } from 'react'
import type { Product } from '@elegantsip/shared'
import { api } from '../../lib/api'
import { errorText, type Notice } from './adminUi'
import { useFeedback } from './ui/Feedback'
import { Spinner } from './ui/controls'

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif'
const MAX_BYTES = 15 * 1024 * 1024

/**
 * Main photo plus gallery. Every change saves straight away: uploads (click or
 * drag in) are re-encoded by the API and added to the end, and the order here
 * is the order on the product page. The first photo is the one on cards.
 */
export default function ProductPhotos({ product, onSaved, notify }: { product: Product; onSaved: () => void; notify: (n: Notice) => void }) {
  const { confirm } = useFeedback()
  const [busy, setBusy] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const photos = [product.imageSrc, ...product.images]

  const save = async (next: string[], label: string, message: string) => {
    setBusy(label)
    try {
      await api.admin.updateProduct(product.slug, { imageSrc: next[0], images: next.slice(1) })
      notify({ tone: 'ok', title: message, text: 'The site shows it on the next page load.' })
      onSaved()
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, 'The photos could not be saved.') })
    } finally {
      setBusy(null)
    }
  }

  const upload = async (files: File[]) => {
    const images = files.filter((f) => ACCEPT.split(',').includes(f.type))
    if (images.length < files.length) notify({ tone: 'error', text: 'Only JPG, PNG, WebP or AVIF photos can be uploaded.' })
    const tooBig = images.find((f) => f.size > MAX_BYTES)
    if (tooBig) return notify({ tone: 'error', text: `${tooBig.name} is over 15 MB.` })
    if (images.length === 0) return

    setBusy('upload')
    const added: string[] = []
    try {
      for (const file of images) added.push((await api.admin.uploadProductPhoto(file)).src)
    } catch (cause) {
      notify({ tone: 'error', text: errorText(cause, 'Upload failed.') })
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
    if (added.length > 0) await save([...photos, ...added], 'upload', `${added.length} photo${added.length === 1 ? '' : 's'} added`)
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...photos]
    const [item] = next.splice(index, 1)
    next.splice(index + by, 0, item)
    void save(next, `move-${index}`, 'Photo order saved')
  }

  const remove = async (index: number) => {
    const ok = await confirm({
      title: 'Remove this photo?',
      body: 'It comes off the product straight away. The file stays on the server, so past orders that show it are unaffected.',
      confirmLabel: 'Remove photo',
      danger: true,
    })
    if (ok) void save(photos.filter((_, j) => j !== index), `remove-${index}`, 'Photo removed')
  }

  const iconButton =
    'grid h-8 w-8 place-items-center rounded-full bg-white/90 text-sm text-[#1b261b] shadow-sm backdrop-blur transition hover:scale-110 hover:bg-white disabled:opacity-40'

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((src, i) => (
          <figure
            key={`${src}-${i}`}
            style={{ '--i': i } as CSSProperties}
            className="adm-rise group relative aspect-square overflow-hidden rounded-2xl bg-[#f2f4ef] ring-1 ring-[#1b261b]/[0.08]"
          >
            <img src={src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
            {i === 0 && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[#1b261b] px-2.5 py-1 text-[10px] font-bold text-white shadow">★ Main photo</span>
            )}
            {busy?.endsWith(`-${i}`) && (
              <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-[1px]">
                <Spinner className="h-6 w-6 text-[#4a7333]" />
              </div>
            )}
            {/* Actions fade in on hover, and stay visible on touch screens. */}
            <figcaption className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/45 to-transparent p-2 pt-8 transition duration-300 sm:translate-y-2 sm:opacity-0 sm:group-hover:translate-y-0 sm:group-hover:opacity-100 sm:group-focus-within:translate-y-0 sm:group-focus-within:opacity-100">
              <span className="flex gap-1">
                <button type="button" disabled={!!busy || i === 0} onClick={() => move(i, -1)} className={iconButton} aria-label="Move earlier">←</button>
                <button type="button" disabled={!!busy || i === photos.length - 1} onClick={() => move(i, 1)} className={iconButton} aria-label="Move later">→</button>
                {i !== 0 && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void save([src, ...photos.filter((_, j) => j !== i)], `main-${i}`, 'Main photo changed')}
                    className={iconButton}
                    aria-label="Make main photo"
                    title="Make main photo"
                  >
                    ★
                  </button>
                )}
              </span>
              <button
                type="button"
                disabled={!!busy || photos.length === 1}
                onClick={() => void remove(i)}
                className={`${iconButton} hover:!bg-rose-50 hover:text-rose-600`}
                aria-label="Remove photo"
                title={photos.length === 1 ? 'A product needs at least one photo' : 'Remove photo'}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 6h12M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6" />
                </svg>
              </button>
            </figcaption>
          </figure>
        ))}

        {/* Upload tile: click or drop files on it. */}
        <button
          type="button"
          disabled={!!busy}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            void upload(Array.from(e.dataTransfer.files))
          }}
          className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition duration-300 ${
            dragging ? 'scale-[1.02] border-[#4a7333] bg-[#8bb56e]/15' : 'border-[#1b261b]/15 bg-white hover:border-[#8bb56e] hover:bg-[#8bb56e]/5'
          }`}
        >
          {busy === 'upload' ? (
            <>
              <Spinner className="h-7 w-7 text-[#4a7333]" />
              <span className="text-xs font-semibold text-[#4a7333]">Uploading…</span>
            </>
          ) : (
            <>
              <span className={`grid h-10 w-10 place-items-center rounded-full bg-[#8bb56e]/15 text-xl text-[#4a7333] transition ${dragging ? 'scale-110' : ''}`}>+</span>
              <span className="text-xs font-semibold text-[#1b261b]">{dragging ? 'Drop to upload' : 'Add photos'}</span>
              <span className="text-[10px] leading-tight text-[#4a584a]">Click or drag in · JPG, PNG, WebP · 15 MB</span>
            </>
          )}
        </button>
      </div>
      <input ref={fileInput} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
      <p className="mt-3 text-[11px] text-[#4a584a]">Square photos look best on cards. Hover a photo to reorder it, make it the main one, or remove it.</p>
    </div>
  )
}
