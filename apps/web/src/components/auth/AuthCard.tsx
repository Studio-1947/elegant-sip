import type { ReactNode } from 'react'

/* Shared shell for the token-landing pages, so confirmation and password reset
   look like one flow rather than two pages that happen to sit next to each
   other. Matches the account and legal page treatment. */

export function AuthCard({
  eyebrow,
  title,
  body,
  tone = 'default',
  busy = false,
  children,
}: {
  eyebrow: string
  title: string
  body?: string
  tone?: 'default' | 'warn'
  busy?: boolean
  children?: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
      <div className="max-w-md mx-auto bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-12 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
        <span
          className={`text-xs font-mono tracking-[0.3em] uppercase block mb-4 ${
            tone === 'warn' ? 'text-[#8a5a12]' : 'text-[#4a7333]'
          }`}
        >
          {eyebrow}
        </span>

        <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">{title}</h1>

        {body && (
          <p className="text-sm text-[#4a584a] leading-relaxed mb-8" aria-busy={busy || undefined}>
            {body}
          </p>
        )}

        {children && <div className="flex flex-col gap-3">{children}</div>}
      </div>
    </div>
  )
}
