export default function ThreePillarsSection() {
  return (
    <section className="px-6 md:px-12 lg:px-16 pb-32 max-w-[1360px] mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
        
        {/* Origin Card */}
        <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
          <img 
            src="/origin.webp" 
            alt="Origin" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />
          <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
            <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">Origin</h3>
            <p className="text-white/85 text-sm leading-relaxed">
              From the highland terraces of Darjeeling to the ancient gardens
              of Uji, we partner directly with generational growers who share
              our obsession with terroir and seasonal harvests.
            </p>
          </div>
        </div>

        {/* Craft Card */}
        <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
          <img 
            src="/craft.webp" 
            alt="Craft" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />
          <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
            <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">Craft</h3>
            <p className="text-white/85 text-sm leading-relaxed">
              Every batch is hand-rolled, shade-dried, and slow-oxidized
              under the guidance of our tea masters. No shortcuts, no
              mechanized blending — just centuries-old technique.
            </p>
          </div>
        </div>

        {/* Experience Card */}
        <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
          <img 
            src="/experience.webp" 
            alt="Experience" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />
          <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
            <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">Experience</h3>
            <p className="text-white/85 text-sm leading-relaxed">
              Brewing is ritual. We include steeping guides, temperature
              curves, and tasting notes with every order — so each cup
              unfolds exactly as the leaves intended.
            </p>
          </div>
        </div>

      </div>
    </section>
  )
}
