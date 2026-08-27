import { useEffect, useRef } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogOptions {
  /** Close the background scroll while the dialog is up. Default: true. */
  lockScroll?: boolean
  /** Close on Escape. Default: true. */
  closeOnEscape?: boolean
}

/**
 * Modal dialog behaviour, shared by every dialog on the site: initial focus,
 * a focus trap, focus restoration to whatever opened it, Escape-to-close and
 * background scroll lock.
 *
 * Without the trap, Tab walks straight out of the dialog and into the page
 * behind the scrim; without restoration, closing drops focus to <body> and a
 * keyboard user loses their place entirely.
 */
export function useDialog(
  isOpen: boolean,
  onClose: () => void,
  { lockScroll = true, closeOnEscape = true }: DialogOptions = {},
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Remember what had focus so it can be handed back on close.
    restoreRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusables = () =>
      Array.from(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )

    // Focus the first control, falling back to the container itself.
    const first = focusables()[0]
    if (first) first.focus()
    else container?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const firstItem = items[0]
      const lastItem = items[items.length - 1]
      const active = document.activeElement
      // Wrap at both ends so focus can never leave the dialog.
      if (e.shiftKey && (active === firstItem || !container?.contains(active))) {
        e.preventDefault()
        lastItem.focus()
      } else if (!e.shiftKey && active === lastItem) {
        e.preventDefault()
        firstItem.focus()
      }
    }

    document.addEventListener('keydown', onKey, true)

    const previousOverflow = document.body.style.overflow
    if (lockScroll) document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKey, true)
      if (lockScroll) document.body.style.overflow = previousOverflow
      // Hand focus back to the trigger.
      restoreRef.current?.focus?.()
    }
  }, [isOpen, onClose, lockScroll, closeOnEscape])

  return containerRef
}
