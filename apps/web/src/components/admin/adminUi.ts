import { ApiClientError } from '../../lib/api'
import type { Toast } from './ui/Feedback'

/* Shared bits for the admin catalogue editor. */

export type Notice = Toast

export const inputClass =
  'mt-1.5 block w-full rounded-xl border border-[#1b261b]/12 bg-white px-3.5 py-2.5 font-sans text-sm normal-case tracking-normal text-[#1b261b] shadow-[inset_0_1px_2px_rgba(15,22,15,0.04)] transition placeholder:text-[#4a584a]/50 hover:border-[#1b261b]/25 focus:border-[#8bb56e] focus:outline-none focus:ring-4 focus:ring-[#8bb56e]/15'

export const labelClass = 'block text-[10px] font-mono uppercase tracking-[0.14em] text-[#4a584a]'

export const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[#1b261b] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-px hover:bg-[#2c3d2c] hover:shadow-md active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35'

export const quietButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1b261b]/12 bg-white px-3 py-2 text-xs font-semibold text-[#1b261b] transition hover:-translate-y-px hover:border-[#8bb56e] hover:shadow-sm active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35'

export const dangerButton =
  'inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-35'

/** A white card that lifts a little on hover. */
export const cardClass =
  'rounded-2xl border border-[#1b261b]/[0.08] bg-white shadow-[0_1px_2px_rgba(15,22,15,0.04)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-18px_rgba(15,22,15,0.35)]'

export const toRupees = (paise: number | null) => (paise === null ? '' : String(paise / 100))

/** "861" or "861.50" → paise. Null for empty; NaN for anything unreadable. */
export const toPaise = (value: string): number | null => {
  const v = value.trim()
  if (!v) return null
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return Number.NaN
  return Math.round(Number(v) * 100)
}

/** The API's own message when it has one; it is written to be shown as-is. */
export const errorText = (cause: unknown, fallback: string) =>
  cause instanceof ApiClientError ? cause.message : fallback
