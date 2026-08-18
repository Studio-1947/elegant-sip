import { useScrollReveal } from '../lib/useScrollReveal'

const PILLARS = [
  {
    title: 'Origin',
    imageSrc: '/origin.webp',
    text: 'From the highland terraces of Darjeeling to the ancient gardens of Uji, we partner directly with generational growers who share our obsession with terroir and seasonal harvests.',
  },
  {
    title: 'Craft',
    imageSrc: '/craft.webp',
    text: 'Every batch is hand-rolled, shade-dried, and slow-oxidized under the guidance of our tea masters. No shortcuts, no mechanized blending — just centuries-old technique.',
  },
  {
    title: 'Experience',
    imageSrc: '/experience.webp',
    text: 'Brewing is ritual. We include steeping guides, temperature curves, and tasting notes with every order — so each cup unfolds exactly as the leaves intended.',
  },
]

export default function ThreePillarsSection() {
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > div', stagger: 0.15 })

  return (
    <section className="bg-[#1b261b] md:bg-transparent px-6 md:px-12 lg:px-16 py-14 md:py-0 md:pb-32 max-w-[1360px] mx-auto mb-14 md:mb-0">
      {/* Phone: dark section heading */}
      <div className="md:hidden mb-8">
        <span className="text-[#8bb56e] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
          From Garden to Cup
        </span>
        <h2 className="text-white text-3xl font-bold tracking-tight">Grown. Crafted. Experienced.</h2>
      </div>

      {/* Phone: horizontal card carousel */}
      <div className="md:hidden flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-6 px-6">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="min-w-[80vw] max-w-[340px] snap-center rounded-2xl overflow-hidden bg-[#2b3a2b] flex flex-col"
          >
            <img src={pillar.imageSrc} alt="" loading="lazy" className="w-full h-48 object-cover" />
            <div className="p-6">
              <h3 className="text-white text-base font-bold uppercase tracking-wide mb-3">{pillar.title}</h3>
              <p className="text-white/80 text-sm leading-relaxed">{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full-height image cards */}
      <div ref={gridRef} className="hidden md:grid grid-cols-3 gap-8 lg:gap-10">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500"
          >
            <img
              src={pillar.imageSrc}
              alt=""
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />
            <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
              <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">{pillar.title}</h3>
              <p className="text-white/85 text-sm leading-relaxed">{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
