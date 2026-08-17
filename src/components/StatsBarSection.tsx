import { useScrollReveal } from '../lib/useScrollReveal'

export default function StatsBarSection() {
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > div' })
  const stats = [
    { value: '3', label: 'Named Gardens' },
    { value: '6', label: 'Steeps per Leaf' },
    { value: '30-Day', label: 'Taste Guarantee' },
    { value: '100%', label: 'Hand-Crafted' },
  ]

  return (
    <section className="px-6 md:px-16 lg:px-24 py-20 max-w-5xl mx-auto">
      <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {stats.map((stat) => (
          <div key={stat.label}>
            <p className="text-[#8bb56e] text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</p>
            <p className="text-[#4a584a]/60 text-[11px] font-mono tracking-widest uppercase mt-2">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
