import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin popup window.
 *
 * Popups can open on top of each other (a confirmation inside the product
 * editor), so this keeps its own stack: only the top-most popup answers
 * Escape and traps Tab, and scroll stays locked until the last one closes.
 * On phones it rises from the bottom as a sheet.
 * ──────────────────────────────────────────────────────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const stack: string[] = []
let savedOverflow = ''

const SIZES = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl' } as const

export default function Modal({
  open,
  onClose,
  title,
  eyebrow,
  size = 'md',
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  eyebrow?: string
  size?: keyof typeof SIZES
  children: ReactNode
  footer?: ReactNode
}) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  // Latest onClose for the key handler, without re-running the open/close effect.
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const restore = document.activeElement as HTMLElement | null
    if (stack.length === 0) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    stack.push(id)

    const focusables = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    ;(focusables()[0] ?? panel.current)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return e.preventDefault()
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(id), 1)
      if (stack.length === 0) document.body.style.overflow = savedOverflow
      restore?.focus?.()
    }
  }, [open, id])

  if (!open) return null

  // Rendered at <body>: an animated (transformed) ancestor would otherwise
  // become the containing block for `fixed` and trap the popup inside it.
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
      <div className="adm-backdrop absolute inset-0 bg-[#0f160f]/50 backdrop-blur-[3px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        className={`adm-pop adm-sheet-sm relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-[#fbfcf9] shadow-[0_30px_80px_-20px_rgba(15,22,15,0.45)] ring-1 ring-black/5 sm:rounded-3xl ${SIZES[size]}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#1b261b]/[0.07] px-6 pb-4 pt-5 sm:px-7">
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#4a7333]">{eyebrow}</p>}
            <h2 id={`${id}-title`} className="mt-1 truncate text-lg font-bold tracking-tight text-[#1b261b]">
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-[#4a584a] transition hover:rotate-90 hover:bg-[#1b261b]/5 hover:text-[#1b261b]"
          >
            <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-5 sm:px-7">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-[#1b261b]/[0.07] bg-white/60 px-6 py-4 sm:px-7">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
