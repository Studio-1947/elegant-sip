import { useScrollReveal } from '../lib/useScrollReveal'
import { buildSrcSet } from '../lib/responsiveImages'

const PILLARS = [
  {
    title: 'Origin',
    imageSrc: '/origin.webp',
    imageAlt: 'Darjeeling tea terraces on a highland slope in morning mist',
    text: 'From the highland terraces of the Rungbong Valley to the warmer slopes below Kurseong, we buy directly from the Darjeeling growers who share our obsession with terroir and seasonal harvests.',
  },
  {
    title: 'Craft',
    imageSrc: '/craft.webp',
    imageAlt: 'Freshly plucked Darjeeling tea leaves being withered by hand',
    text: 'First flush is withered long and fired light, so the leaf keeps the aromatics that make it worth buying. No blending across estates, no anonymity — just the grade the garden actually produced.',
  },
  {
    title: 'Experience',
    imageSrc: '/experience.webp',
    imageAlt: 'A brewed cup of first flush Darjeeling beside loose leaves',
    text: 'Brewing is ritual. Every product page carries the exact card for that grade — temperature, steep time, leaf amount and steep count — so each cup unfolds exactly as the leaves intended.',
  },
]

export default function ThreePillarsSection() {
  const gridRef = useScrollReveal<HTMLDivElement>({ target: ':scope > div', stagger: 0.15 })

  return (
    <section className="bg-[#1b261b] lg:bg-transparent px-6 md:px-12 lg:px-16 py-14 md:py-16 lg:py-0 lg:pb-32 max-w-[1360px] mx-auto mb-14 lg:mb-0">
      {/* Phone & tablet: dark section heading */}
      <div className="lg:hidden mb-8">
        {/* This block is dark below lg and light above, so the accent has to
            flip with it: #4a7333 is only 2.82:1 on the dark green. */}
        <span className="text-[#a8cf8a] lg:text-[#4a7333] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
          From Garden to Cup
        </span>
        <h2 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Grown. Crafted. Experienced.</h2>
      </div>

      {/* Phone & tablet: horizontal card carousel */}
      <div className="lg:hidden flex gap-4 md:gap-6 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-6 px-6 md:-mx-12 md:px-12">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="min-w-[80vw] sm:min-w-[52vw] md:min-w-[40vw] max-w-[340px] md:max-w-[380px] snap-center rounded-2xl overflow-hidden bg-[#2b3a2b] flex flex-col"
          >
            <img src={pillar.imageSrc} srcSet={buildSrcSet(pillar.imageSrc)} sizes="(max-width: 768px) 100vw, 33vw" alt={pillar.imageAlt} loading="lazy" width={1200} height={800} className="w-full h-48 md:h-56 object-cover" />
            <div className="p-6">
              <h3 className="text-white text-base font-bold uppercase tracking-wide mb-3">{pillar.title}</h3>
              <p className="text-white/80 text-sm leading-relaxed">{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full-height image cards */}
      <div ref={gridRef} className="hidden lg:grid grid-cols-3 gap-8 lg:gap-10">
        {PILLARS.map((pillar) => (
          <div
            key={pillar.title}
            className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500"
          >
            <img
              src={pillar.imageSrc}
              srcSet={buildSrcSet(pillar.imageSrc)}
              sizes="33vw"
              alt={pillar.imageAlt}
              loading="lazy"
              width={1200}
              height={800}
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
