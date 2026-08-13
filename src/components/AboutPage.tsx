import { Link, useDocumentMeta } from '../lib/router'

const TIMELINE = [
  { year: '2024', title: 'The first harvest', text: 'Elegant Sip is founded on a single conviction: tea should name its garden the way wine names its vineyard.' },
  { year: '2025', title: 'Direct relationships', text: 'Our buyers move into Wuyi, Guangxi, and Fuding during harvest seasons, buying whole lots straight from the estates.' },
  { year: '2026', title: 'The collection grows', text: 'Three signature single-origin blends, a curated Trio, and a Taste Matcher that helps every palate find its cup.' },
]

export default function AboutPage() {
  useDocumentMeta(
    'Our Story — Elegant Sip',
    'Elegant Sip sources the rarest single-origin leaves directly from estate gardens — no auction houses, no middlemen, no anonymity.',
  )

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <img src="/harvest.webp" alt="Tea plantation at harvest" className="w-full h-[50vh] object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent flex items-end">
          <div className="max-w-5xl mx-auto w-full px-6 md:px-12 pb-14">
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Our Story</span>
            <h1 className="text-white text-4xl md:text-6xl font-bold uppercase tracking-tight leading-[1.05]">
              The Garden is <span className="text-[#8bb56e]">the Brand</span>
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-24">
        <p className="text-lg md:text-xl font-light leading-relaxed mb-10 text-[#2b3a2b]">
          Most tea is sold as a number in an auction lot. We think that's backwards. Elegant Sip exists
          to put a name — a garden, a grower, a harvest morning — on every cup.
        </p>
        <div className="space-y-6 text-sm text-[#4a584a] leading-relaxed">
          <p>
            It started with a single question: why can we trace a coffee bean to the exact hillside it
            grew on, but not a tea leaf? Because tea's auction system blends hundreds of gardens into
            anonymous lots, graded by brokers and sold by number. The person who grew the tea is usually
            the last one paid.
          </p>
          <p>
            So we built the system we wanted to buy from. Our buyers spend the harvest seasons on the
            ground in Wuyi, Guangxi, and Fuding — tasting from the withering racks, walking the terraces,
            and buying whole lots directly from the estates. We pay growers a premium for the right to
            name them on the tin.
          </p>
          <p>
            This is not charity; it's quality control. When a grower is paid properly, they can pick at
            the perfect moment instead of the most profitable one. They can hand-roll instead of
            machine-roll, slow-oxidize instead of rush. The tea tastes like a place, because it is a place.
          </p>
          <p>
            That also means our supply is finite. When a first-flush lot is gone, it's gone until next
            spring. We'd rather run out of a tea than run out of standards.
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border-y border-[#1b261b]/10">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4 text-center">The Journey So Far</span>
          <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-tight text-center mb-16">Milestones</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {TIMELINE.map((item) => (
              <div key={item.year} className="text-center md:text-left">
                <p className="text-[#8bb56e] text-3xl font-bold font-mono mb-3">{item.year}</p>
                <h3 className="font-bold uppercase tracking-wide text-sm mb-2">{item.title}</h3>
                <p className="text-xs text-[#4a584a] leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Values */}
      <div className="max-w-5xl mx-auto px-6 md:px-12 py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { title: 'Origin', text: 'Every tea names its garden, its elevation, its harvest date, and its cultivar — on the tin.' },
          { title: 'Craft', text: 'Hand-rolled, shade-dried, slow-oxidized under the guidance of tea masters. No shortcuts.' },
          { title: 'Experience', text: 'Brewing cards with every order — temperature curves, steep counts, tasting notes.' },
        ].map((v) => (
          <div key={v.title} className="bg-white border border-[#1b261b]/10 rounded-2xl p-8">
            <h3 className="text-lg font-bold uppercase tracking-wide mb-3 text-[#8bb56e]">{v.title}</h3>
            <p className="text-xs text-[#4a584a] leading-relaxed">{v.text}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <h2 className="text-3xl font-bold uppercase tracking-tight mb-4">Taste the story</h2>
        <p className="text-sm text-[#4a584a] mb-8">Start with the Taste Matcher, or dive straight into the collection.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/shop" className="bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors text-center">
            Shop the Collection
          </Link>
          <Link to="/journal" className="border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-white text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-all text-center">
            Read the Journal
          </Link>
        </div>
      </div>
    </div>
  )
}
