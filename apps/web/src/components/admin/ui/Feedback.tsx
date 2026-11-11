import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Modal from './Modal'

/* ────────────────────────────────────────────────────────────────────────────
 * Admin feedback: toasts for "that worked / that didn't", and a confirm popup
 * for anything destructive. Both come from one provider around the admin page.
 *
 *   const { toast, confirm } = useFeedback()
 *   toast({ tone: 'ok', text: 'Saved.' })
 *   if (await confirm({ title: 'Remove photo?', confirmLabel: 'Remove', danger: true })) …
 * ──────────────────────────────────────────────────────────────────────────── */

export type Toast = { tone: 'ok' | 'error' | 'info'; text: string; title?: string }
type ConfirmOptions = { title: string; body?: ReactNode; confirmLabel?: string; danger?: boolean }

type Feedback = {
  toast: (t: Toast) => void
  confirm: (o: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<Feedback | null>(null)

export const useFeedback = () => {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback must be used inside <FeedbackProvider>')
  return value
}

const TONES = {
  ok: { ring: 'ring-[#8bb56e]/40', icon: 'bg-[#4a7333] text-white', bar: 'bg-[#8bb56e]', glyph: '✓', title: 'Done' },
  error: { ring: 'ring-rose-300/60', icon: 'bg-rose-600 text-white', bar: 'bg-rose-400', glyph: '!', title: 'Couldn’t do that' },
  info: { ring: 'ring-sky-200', icon: 'bg-sky-600 text-white', bar: 'bg-sky-400', glyph: 'i', title: 'Note' },
} as const

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { id: number; ms: number })[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), [])

  const toast = useCallback(
    (t: Toast) => {
      const id = ++nextId.current
      const ms = t.tone === 'error' ? 7000 : 4200
      setToasts((all) => [...all.slice(-3), { ...t, id, ms }])
      window.setTimeout(() => dismiss(id), ms)
    },
    [dismiss],
  )

  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...o, resolve })), [])

  const settle = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      <Modal
        open={pending !== null}
        onClose={() => settle(false)}
        size="sm"
        eyebrow="Please confirm"
        title={pending?.title ?? ''}
        footer={
          <>
            <button onClick={() => settle(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-[#4a584a] transition hover:bg-[#1b261b]/5">
              Keep it
            </button>
            <button
              onClick={() => settle(true)}
              className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-[0.97] ${
                pending?.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#1b261b] hover:bg-[#4a7333]'
              }`}
            >
              {pending?.confirmLabel ?? 'Confirm'}
            </button>
          </>
        }
      >
        <div className="text-sm leading-relaxed text-[#4a584a]">{pending?.body ?? 'This can’t be undone.'}</div>
      </Modal>

      {createPortal(
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
        {toasts.map((t) => {
          const tone = TONES[t.tone]
          return (
            <div
              key={t.id}
              role={t.tone === 'error' ? 'alert' : 'status'}
              className={`adm-toast pointer-events-auto relative w-full overflow-hidden rounded-2xl bg-white/95 shadow-[0_18px_50px_-18px_rgba(15,22,15,0.45)] ring-1 backdrop-blur sm:w-[22rem] ${tone.ring}`}
            >
              <div className="flex items-start gap-3 p-4 pr-10">
                <span className={`grid h-7 w-7 flex-shrink-0 place-items-center rounded-full text-xs font-bold ${tone.icon}`}>{tone.glyph}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-[#1b261b]">{t.title ?? tone.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#4a584a]">{t.text}</p>
                </div>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-[#4a584a] transition hover:bg-[#1b261b]/5"
              >
                ×
              </button>
              <span className={`adm-progress absolute inset-x-0 bottom-0 h-0.5 ${tone.bar}`} style={{ animationDuration: `${t.ms}ms` }} />
            </div>
          )
        })}
      </div>,
      document.body,
      )}
    </FeedbackContext.Provider>
  )
}
