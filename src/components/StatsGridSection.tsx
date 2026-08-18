import { useScrollReveal } from '../lib/useScrollReveal'

const PROMISES = [
  {
    title: 'Direct-from-Garden',
    eyebrow: 'No Auction Middlemen',
    text: 'We source straight from small tea estates and growers, cutting out auction houses so more value reaches the people who actually grow the leaf.',
  },
  {
    title: 'Single-Origin',
    eyebrow: 'Darjeeling Sourced',
    text: "Every batch comes from identified gardens in the Darjeeling hills — not blended, not anonymous. You'll know exactly where your tea is from.",
  },
  {
    title: 'Freshly Packed',
    eyebrow: 'Harvest to Doorstep',
    text: 'We ship close to harvest instead of sitting in warehouses for months, so what you get is closer to how it tasted in the garden.',
  },
]

export default function StatsGridSection() {
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > div' })

  return (
    <section className="px-6 md:px-16 lg:px-24 pb-10 max-w-6xl mx-auto">
      {/* Phone: numbered promise list */}
      <div className="md:hidden">
        {PROMISES.map((item, i) => (
          <div key={item.title} className="flex gap-6 py-7 border-b border-[#1b261b]/10 last:border-b-0">
            <span className="text-[#8bb56e] font-mono font-bold text-sm pt-0.5">0{i + 1}</span>
            <div>
              <h4 className="text-[#1b261b] text-lg font-bold tracking-tight mb-1">{item.title}</h4>
              <p className="text-[#8bb56e] text-[10px] font-mono font-bold tracking-[0.2em] uppercase mb-3">{item.eyebrow}</p>
              <p className="text-sm text-[#4a584a] leading-relaxed">{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: bordered subgrid cards */}
      <div ref={gridRef} className="hidden md:grid grid-cols-3 grid-rows-[auto_auto_auto] gap-y-2 border-y border-[#1b261b]/10 bg-white">
        {PROMISES.map((item, i) => (
          <div
            key={item.title}
            className={`p-8 text-left row-span-3 grid grid-rows-subgrid ${i < PROMISES.length - 1 ? 'border-r border-[#1b261b]/10' : ''}`}
          >
            <span className="text-[#1b261b] text-3xl lg:text-4xl font-bold tracking-tight block">{item.title}</span>
            <h4 className="text-base font-bold text-[#1b261b]">{item.eyebrow}</h4>
            <p className="text-xs text-[#4a584a] leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
