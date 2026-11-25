/**
 * One question of an accordion: the question as a button, the answer opening
 * below it. Height animates via grid-template-rows (0fr → 1fr), with no JS
 * measuring. Shared by the FAQ page and the product pages.
 */
export default function FaqItem({
  question,
  answer,
  panelId,
  open,
  onToggle,
}: {
  question: string
  answer: string
  panelId: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden transition-shadow hover:shadow-[0_8px_24px_rgba(27,38,27,0.04)]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 cursor-pointer text-left text-sm font-bold"
      >
        {question}
        <span
          className={`text-[#4a7333] text-lg leading-none flex-shrink-0 transition-transform duration-300 ease-out ${open ? 'rotate-45' : ''}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>
      <div
        id={panelId}
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', opacity: open ? 1 : 0 }}
      >
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <p className="px-6 pb-6 text-xs text-[#4a584a] leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  )
}
