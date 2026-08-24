import { useEffect, useId, useRef, useState } from 'react'

interface Option {
  value: string
  label: string
}

interface SelectDropdownProps {
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
  ariaLabel: string
  /** Width/layout classes for the whole control (e.g. "w-full sm:w-auto"). */
  className?: string
}

/**
 * Brand-styled replacement for a native <select>: custom options panel,
 * keyboard support (arrows / Enter / Escape), and outside-click dismissal.
 * Focus stays on the trigger; the active option is conveyed via
 * aria-activedescendant.
 */
export default function SelectDropdown({ value, options, onChange, ariaLabel, className = '' }: SelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selectedIndex = options.findIndex((o) => o.value === value)

  // Close when clicking/tapping anywhere outside
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  const openList = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault()
        openList()
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        setOpen(false)
        break
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % options.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + options.length) % options.length)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex >= 0) choose(options[activeIndex].value)
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        // WCAG 2.5.3: the accessible name must contain the visible label, so a
        // speech-input user saying what they see actually activates the
        // control. A bare aria-label="Sort products" replaced the visible
        // "Sort: Featured" instead of extending it.
        aria-describedby={`${listId}-purpose`}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
        className="w-full flex items-center justify-between gap-3 text-xs font-bold text-[#1b261b] bg-white border border-[#1b261b]/10 rounded-full sm:rounded-lg py-3 sm:py-2.5 px-5 sm:px-4 cursor-pointer focus:border-[#8bb56e] transition-colors"
      >
        <span className="whitespace-nowrap">{options[selectedIndex]?.label ?? ariaLabel}</span>
        {/* Carries the control's purpose without overriding the visible label,
            which is what the accessible name must be built from. */}
        <span id={`${listId}-purpose`} className="sr-only">{ariaLabel}</span>
        <svg
          className={`w-3.5 h-3.5 text-[#4a584a] flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-30 mt-2 left-0 right-0 sm:left-auto sm:right-0 sm:w-56 bg-white border border-[#1b261b]/10 rounded-xl shadow-[0_12px_40px_rgba(27,38,27,0.12)] overflow-hidden py-1.5"
        >
          {options.map((option, i) => {
            const selected = option.value === value
            const active = i === activeIndex
            return (
              <button
                key={option.value}
                id={`${listId}-${i}`}
                type="button"
                role="option"
                aria-selected={selected}
                // Keyboard interaction is driven by the trigger via
                // aria-activedescendant; these must not be tab stops.
                tabIndex={-1}
                onClick={() => choose(option.value)}
                onPointerEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center justify-between gap-3 text-left text-xs px-5 sm:px-4 py-2.5 cursor-pointer transition-colors ${
                  active ? 'bg-[#8bb56e]/10' : ''
                } ${selected ? 'font-bold text-[#4a7333]' : 'font-medium text-[#1b261b]'}`}
              >
                {option.label}
                {selected && (
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
