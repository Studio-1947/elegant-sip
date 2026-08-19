import { PRODUCTS } from '../data/products'
import { Link, useDocumentMeta } from '../lib/router'
import { useScrollReveal } from '../lib/useScrollReveal'

const GOLDEN_RULES = [
  {
    title: 'Temperature is everything',
    text: 'Ninety percent of disappointing tea is a temperature problem. Greener teas need cooler water — boiling scorches their aromatics into bitterness. Darker, more oxidized leaves need the heat to open up.',
  },
  {
    title: 'Time with intention',
    text: 'An extra minute is not "stronger" — it is astringent. Measure the leaf, time the steep, and adjust from the card, not from habit.',
  },
  {
    title: 'The re-steep is the point',
    text: 'Whole leaf is designed to be steeped again. The first steep is the introduction; the third is often the masterpiece. Resteeping is not thrift — it is the intended experience.',
  },
]

export default function BrewingGuidePage() {
  useDocumentMeta(
    'Brewing Guide — Elegant Sip',
    'Temperature, time, leaf amount, and steep counts for every Elegant Sip tea — the brewing card behind every pack.',
  )
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > *', stagger: 0.12 })

  const teas = PRODUCTS.filter((p) => p.brewingGuide)

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-5xl mx-auto">
        {/* Banner */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-5">Brewing Guide</span>
          <h1 className="text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05] mb-6">
            From Leaf to <span className="text-[#8bb56e]">Golden Cup</span>
          </h1>
          <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
            The same brewing card that ships with every pack — temperature, time, leaf amount, and
            steep counts, tuned to each tea. Follow it once, then adjust to your palate.
          </p>
        </div>

        {/* Golden rules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {GOLDEN_RULES.map((rule, i) => (
            <div key={rule.title} className="bg-white border border-[#1b261b]/10 rounded-2xl p-6">
              <span className="text-[#8bb56e] font-mono text-xs block mb-3">0{i + 1}</span>
              <h2 className="text-sm font-bold uppercase tracking-wide mb-2">{rule.title}</h2>
              <p className="text-xs text-[#4a584a] leading-relaxed">{rule.text}</p>
            </div>
          ))}
        </div>

        {/* Per-tea brewing cards */}
        <div ref={gridRef} className="space-y-8">
          {teas.map((tea) => (
            <div key={tea.id} className="bg-white border border-[#1b261b]/10 rounded-2xl overflow-hidden md:flex">
              <Link to={`/product/${tea.id}`} className="md:w-56 flex-shrink-0 block">
                <img src={tea.imageSrc} alt={tea.name} loading="lazy" className="w-full h-48 md:h-full object-cover" />
              </Link>
              <div className="p-6 md:p-8 flex-grow">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-5">
                  <div>
                    <span className="text-[#8bb56e] text-[10px] font-mono tracking-[0.25em] uppercase block mb-1">{tea.category}</span>
                    <Link to={`/product/${tea.id}`} className="text-xl font-bold uppercase tracking-tight hover:text-[#8bb56e] transition-colors">
                      {tea.name}
                    </Link>
                  </div>
                  <Link to={`/product/${tea.id}`} className="text-[10px] font-mono tracking-widest uppercase text-[#8bb56e] hover:text-[#1b261b] transition-colors">
                    Shop this tea →
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                  {(
                    [
                      ['Temperature', tea.brewingGuide!.temperature],
                      ['Steep time', tea.brewingGuide!.time],
                      ['Steeps', tea.brewingGuide!.steeps],
                      ['Leaf', tea.brewingGuide!.leafAmount],
                    ] as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="bg-[#f9faf7] border border-[#1b261b]/5 rounded-xl p-3.5">
                      <p className="text-[9px] font-mono tracking-widest uppercase text-[#4a584a] mb-1">{label}</p>
                      <p className="text-sm font-bold">{value}</p>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-[#4a584a] italic leading-relaxed">{tea.brewingGuide!.notes}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cross-link */}
        <div className="text-center mt-16">
          <p className="text-sm text-[#4a584a] mb-6">Want the theory behind the card?</p>
          <Link
            to="/journal/field-guide-to-steeping"
            className="inline-block border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-white text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-all"
          >
            Read: A Field Guide to Steeping
          </Link>
        </div>
      </div>
    </div>
  )
}
