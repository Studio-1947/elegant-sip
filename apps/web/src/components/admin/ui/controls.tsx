import type { ReactNode } from 'react'

/* Small admin controls: an animated on/off switch, a segmented tab bar, a spinner. */

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-50 ${
        checked ? 'bg-[#4a7333]' : 'bg-[#1b261b]/20'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] ${
          checked ? 'translate-x-[22px]' : 'translate-x-[2px]'
        }`}
      />
    </button>
  )
}

/** Segmented tabs whose highlight slides to the active one. */
export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; badge?: number }[]
}) {
  const index = Math.max(0, items.findIndex((i) => i.value === value))
  return (
    <div role="tablist" className="relative inline-grid rounded-2xl bg-[#1b261b]/[0.06] p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden="true"
        className="absolute bottom-1 top-1 rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.3,1.2,0.5,1)]"
        style={{ width: `calc((100% - 0.5rem) / ${items.length})`, left: '0.25rem', transform: `translateX(${index * 100}%)` }}
      />
      {items.map((item) => (
        <button
          key={item.value}
          role="tab"
          aria-selected={item.value === value}
          onClick={() => onChange(item.value)}
          className={`relative z-10 flex items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition-colors sm:px-5 ${
            item.value === value ? 'text-[#1b261b]' : 'text-[#4a584a] hover:text-[#1b261b]'
          }`}
        >
          {item.label}
          {item.badge ? (
            <span className="min-w-[1.25rem] rounded-full bg-[#4a7333] px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">{item.badge > 99 ? '99+' : item.badge}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`adm-spin ${className}`} fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Empty state with a soft icon, used by every list. */
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="adm-rise flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#8bb56e]/15 text-xl text-[#4a7333]">❦</span>
      <p className="mt-4 text-sm font-semibold text-[#1b261b]">{title}</p>
      {children && <p className="mt-1 max-w-sm text-xs text-[#4a584a]">{children}</p>}
    </div>
  )
}
