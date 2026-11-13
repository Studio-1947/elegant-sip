/**
 * A note to buyers while the packaging changes over, shown under the Our
 * Collections heading (above the Taste Matcher prompt) on the shop page and
 * the homepage. Remove once the new packs are standard.
 * `className` sets the spacing around it.
 */
export default function PackagingNotice({ className = '' }: { className?: string }) {
  return (
    <div
      role="note"
      className={`max-w-2xl mx-auto flex gap-3 md:gap-4 rounded-2xl border border-[#b0782e]/25 bg-[#fdf6ea] px-4 py-4 md:px-6 md:py-5 text-left ${className}`}
    >
      <span aria-hidden="true" className="flex-shrink-0 grid h-9 w-9 place-items-center rounded-full bg-[#b0782e]/10 text-[#9a6522]">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      </span>
      <div>
        <p className="text-[11px] font-mono font-bold tracking-[0.2em] uppercase text-[#9a6522]">Dear Valued Customer</p>
        <p className="mt-1.5 text-sm leading-relaxed text-[#4a584a]">
          A little note: We&rsquo;re currently refining our packaging. Your order may arrive in transitional packaging but the
          quality and care behind every cup remain unchanged. Thank you for your understanding.
        </p>
      </div>
    </div>
  )
}
