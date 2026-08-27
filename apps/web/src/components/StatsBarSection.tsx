import { useScrollReveal } from '../lib/useScrollReveal'

export default function StatsBarSection() {
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > div' })
  const stats = [
    { value: '4', label: 'Leaf Grades' },
    { value: '3', label: 'Harvest Flushes' },
    { value: 'Free', label: 'Shipping over ₹4,000' },
    { value: '100%', label: 'Freshness Guarantee' },
  ]

  return (
    <section className="px-6 md:px-16 lg:px-24 py-10 md:py-20 max-w-5xl mx-auto">
      <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-0 md:gap-8 text-center border-y border-[#1b261b]/10 md:border-0">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`py-8 md:py-0 px-2 border-[#1b261b]/10 md:border-0 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b' : ''}`}
          >
            <p className="text-[#4a7333] text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</p>
            <p className="text-[#4a584a] text-[11px] font-mono tracking-widest uppercase mt-2">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
