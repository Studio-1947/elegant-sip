import ScrollExpand from './ScrollExpand'

/**
 * HeroScrollSection
 *
 * The cinematic section that replaces the post-parallax black screen.
 * Uses two ScrollExpand instances:
 *  1. Full-screen, pinned expand with rich content reveal.
 *  2. Fixed-height secondary showcase (520px).
 *
 * src: /hero.webp (placed in /public)
 */
export default function HeroScrollSection() {
  return (
    <div className="relative bg-black">
      {/* ── Primary: window-pinned expand with content reveal ── */}
      <ScrollExpand
        src="/hero.webp"
        alt="Elegant Sip — hand-picked single-origin tea"
        title="Brew Elegance | Sip Luxury"
        scrollHint="Scroll"
        useWindowScroll
      >
        {/* Content revealed after the frame fully expands (Light Theme) */}
        <div className="relative z-20 bg-[#f9faf7] overflow-hidden">

          {/* Floating Parallax Vector Tea Leaves */}
          <div className="absolute top-[10%] left-[5%] pointer-events-none z-10 opacity-30 hidden lg:block">
            <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="#8bb56e" strokeWidth="1.5">
              <path d="M50 10 C70 30 80 55 50 90 C20 55 30 30 50 10 Z" />
              <path d="M50 10 L50 90" strokeWidth="1" strokeDasharray="3,3" />
              <path d="M50 30 Q65 35 75 25" strokeWidth="0.8" />
              <path d="M50 45 Q35 50 25 40" strokeWidth="0.8" />
              <path d="M50 60 Q65 65 70 55" strokeWidth="0.8" />
            </svg>
          </div>

          <div className="absolute top-[40%] right-[6%] pointer-events-none z-10 opacity-25 hidden lg:block">
            <svg width="160" height="160" viewBox="0 0 100 100" fill="none" stroke="#8bb56e" strokeWidth="1">
              <path d="M50 10 C75 35 70 70 50 90 C30 70 25 35 50 10 Z" />
              <path d="M50 10 Q50 50 50 90" />
              <path d="M50 35 Q68 40 72 30" />
              <path d="M50 55 Q32 60 28 50" />
            </svg>
          </div>

          {/* Gradient transition from transparent video to solid light paper */}
          <div className="h-32 bg-gradient-to-b from-transparent to-[#f9faf7]" />

          {/* ── Hero Section ── */}
          <section className="px-6 md:px-16 lg:px-24 pt-16 pb-24 max-w-6xl mx-auto text-center">
            <p className="text-[#8bb56e] text-xs font-mono tracking-[0.35em] uppercase mb-6">
              Est. 2024 · Single Origin · Hand-Crafted
            </p>
            <h2 className="text-[#1b261b] text-4xl md:text-6xl lg:text-7xl font-bold uppercase tracking-tight leading-[1.1] mb-8">
              Where Every Leaf<br />
              <span className="text-[#8bb56e]">Tells a Story</span>
            </h2>
            <p className="text-[#4a584a] text-base md:text-lg max-w-2xl mx-auto leading-relaxed font-light">
              Elegant Sip is more than a tea brand — it's a sensory journey from the
              mist-covered highlands to your cup. We source the rarest single-origin
              leaves and craft each blend with the precision of a master sommelier.
            </p>
            <div className="w-16 h-[1px] bg-[#8bb56e]/60 mx-auto mt-12" />
          </section>

          {/* ── Stats Card Grid ── */}
          <section className="px-6 md:px-16 lg:px-24 pb-10 max-w-6xl mx-auto">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 border-y border-[#1b261b]/10 bg-white">
              {/* Card 1 */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-[#1b261b]/10 text-left">
                <span className="text-[#166534] text-5xl font-bold tracking-tight block mb-4">1,489+</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2">Local Gardens Registered</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  Join thousands of verified estate partners and smallholder tea growers who trust our platform to share their harvest with enthusiasts.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-[#1b261b]/10 text-left">
                <span className="text-[#166534] text-5xl font-bold tracking-tight block mb-4">₹1</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2">Fair Trade Premium</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  Our direct sourcing model ensures maximum value reaches local growers while providing you with exceptional single-origin teas.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-8 text-left">
                <span className="text-[#166534] text-5xl font-bold tracking-tight block mb-4">₹23,789+</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2">Average Monthly Earnings Per Plucker</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  Tea pluckers earn significantly more through our direct partnership program compared to traditional auctions with high broker fees.
                </p>
              </div>
            </div>
          </section>

          {/* Showcase Image (Full Viewport Width Edge-to-Edge) */}
          <div className="w-full overflow-hidden pb-20">
            <img
              src="/harvest.webp"
              alt="Tea plantation at harvest"
              className="w-full h-auto block object-cover"
            />
          </div>

          {/* ── Three Pillars ── */}
          <section className="px-6 md:px-16 lg:px-24 pb-32 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">

              <div className="group p-8 md:p-10 rounded-2xl border border-[#1b261b]/10 bg-[#1b261b]/[0.02] hover:bg-[#1b261b]/[0.05] transition-all duration-500">
                <div className="w-12 h-12 rounded-full border border-[#8bb56e]/50 flex items-center justify-center mb-6 group-hover:border-[#8bb56e] transition-colors duration-500">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#8bb56e]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    <path d="M12 2c3 3.5 4 8 0 16" />
                    <path d="M12 2c-3 3.5-4 8 0 16" />
                    <path d="M2 12h20" />
                  </svg>
                </div>
                <h3 className="text-[#1b261b] text-xl font-bold uppercase tracking-wide mb-3">Origin</h3>
                <p className="text-[#4a584a] text-sm leading-relaxed">
                  From the highland terraces of Darjeeling to the ancient gardens
                  of Uji, we partner directly with generational growers who share
                  our obsession with terroir and seasonal harvests.
                </p>
              </div>

              <div className="group p-8 md:p-10 rounded-2xl border border-[#1b261b]/10 bg-[#1b261b]/[0.02] hover:bg-[#1b261b]/[0.05] transition-all duration-500">
                <div className="w-12 h-12 rounded-full border border-[#8bb56e]/50 flex items-center justify-center mb-6 group-hover:border-[#8bb56e] transition-colors duration-500">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#8bb56e]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
                  </svg>
                </div>
                <h3 className="text-[#1b261b] text-xl font-bold uppercase tracking-wide mb-3">Craft</h3>
                <p className="text-[#4a584a] text-sm leading-relaxed">
                  Every batch is hand-rolled, shade-dried, and slow-oxidized
                  under the guidance of our tea masters. No shortcuts, no
                  mechanized blending — just centuries-old technique.
                </p>
              </div>

              <div className="group p-8 md:p-10 rounded-2xl border border-[#1b261b]/10 bg-[#1b261b]/[0.02] hover:bg-[#1b261b]/[0.05] transition-all duration-500">
                <div className="w-12 h-12 rounded-full border border-[#8bb56e]/50 flex items-center justify-center mb-6 group-hover:border-[#8bb56e] transition-colors duration-500">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#8bb56e]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 010 8h-1" />
                    <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
                    <path d="M6 1v3M10 1v3M14 1v3" />
                  </svg>
                </div>
                <h3 className="text-[#1b261b] text-xl font-bold uppercase tracking-wide mb-3">Experience</h3>
                <p className="text-[#4a584a] text-sm leading-relaxed">
                  Brewing is ritual. We include steeping guides, temperature
                  curves, and tasting notes with every order — so each cup
                  unfolds exactly as the leaves intended.
                </p>
              </div>

            </div>
          </section>

          {/* ── Philosophy Quote ── */}
          <section className="px-6 md:px-16 lg:px-24 py-28 max-w-4xl mx-auto text-center border-t border-b border-[#1b261b]/10">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-[#8bb56e]/40 mx-auto mb-8" fill="currentColor">
              <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
            </svg>
            <blockquote className="text-[#2b3a2b] text-xl md:text-2xl lg:text-3xl font-light italic leading-relaxed mb-8">
              Tea is the elixir of life — a bridge between the hurried world
              and the stillness within.
            </blockquote>
            <cite className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase not-italic">
              — The Elegant Sip Manifesto
            </cite>
          </section>

          {/* ── Stats Bar ── */}
          <section className="px-6 md:px-16 lg:px-24 py-20 max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '12+', label: 'Origin Regions' },
                { value: '47', label: 'Single-Origin Blends' },
                { value: '8K+', label: 'Cups Served Monthly' },
                { value: '100%', label: 'Hand-Crafted' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[#8bb56e] text-3xl md:text-4xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-[#4a584a]/60 text-[11px] font-mono tracking-widest uppercase mt-2">{stat.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── Footer ── */}
          <footer className="px-6 md:px-16 lg:px-24 py-16 border-t border-[#1b261b]/10 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-3">
                <svg
                  viewBox="0 0 100 100"
                  className="w-6 h-6 fill-none stroke-current text-[#8bb56e]"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M50 20 C65 35 75 55 50 80 C25 55 35 35 50 20 Z" />
                  <path d="M50 20 C50 40 50 60 50 80" strokeWidth="1.5" />
                </svg>
                <span className="text-[#1b261b] text-sm font-bold uppercase tracking-tight">
                  Elegant Sip
                </span>
              </div>
              <p className="text-[#4a584a]/40 text-xs font-mono tracking-wider">
                © 2024 Elegant Sip. All rights reserved.
              </p>
            </div>
          </footer>

        </div>
      </ScrollExpand>
    </div>
  )
}
