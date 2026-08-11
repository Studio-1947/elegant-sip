import { useState } from 'react'
import ScrollExpand from './ScrollExpand'

interface Product {
  id: string
  name: string
  price: number
  description: string
  imageSrc: string
}

function ProductCard({ name, price, description, imageSrc }: Product) {
  const [quantity, setQuantity] = useState(1)
  const [isAdding, setIsAdding] = useState(false)
  const [isAdded, setIsAdded] = useState(false)

  const handleDecrease = () => {
    if (quantity > 1) setQuantity(quantity - 1)
  }

  const handleIncrease = () => {
    setQuantity(quantity + 1)
  }

  const handleAddToCart = () => {
    setIsAdding(true)
    setTimeout(() => {
      setIsAdding(false)
      setIsAdded(true)
      setTimeout(() => {
        setIsAdded(false)
      }, 2000)
    }, 800)
  }

  return (
    <div className="group bg-white rounded-2xl border border-[#1b261b]/10 overflow-hidden flex flex-col transition-all duration-500 hover:shadow-[0_12px_30px_rgba(27,38,27,0.06)] hover:-translate-y-1">
      {/* Product Image Wrapper */}
      <div className="relative aspect-[4/5] bg-[#fdfdfd] overflow-hidden">
        <img 
          src={imageSrc} 
          alt={name} 
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
      </div>

      {/* Info Block */}
      <div className="p-6 md:p-8 flex flex-col flex-grow">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-[#1b261b] text-lg lg:text-xl font-bold font-sans tracking-wide">{name}</h3>
          <span className="text-[#1b261b] text-base lg:text-lg font-bold">${price}.00</span>
        </div>
        <p className="text-[#4a584a] text-xs leading-relaxed mb-6 flex-grow">{description}</p>

        {/* Quantity & CTA Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch mt-auto">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between border border-[#1b261b]/20 rounded-lg px-4 py-2 sm:w-28 bg-[#f9faf7]">
            <button 
              onClick={handleDecrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="text-[#1b261b] font-mono text-sm font-semibold select-none">{quantity}</span>
            <button 
              onClick={handleIncrease}
              className="text-[#1b261b] hover:text-[#8bb56e] font-bold text-lg leading-none transition-colors px-1"
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          {/* Add to Cart CTA */}
          <button 
            onClick={handleAddToCart}
            disabled={isAdding || isAdded}
            className={`flex-grow text-xs font-bold tracking-widest uppercase py-3 px-6 rounded-lg transition-all duration-300 active:scale-[0.98] ${
              isAdded 
                ? 'bg-[#8bb56e] text-white' 
                : isAdding
                ? 'bg-[#1b261b]/50 text-white/50 cursor-wait'
                : 'bg-[#1b261b] hover:bg-[#2b3a2b] text-white'
            }`}
          >
            {isAdding ? 'Adding...' : isAdded ? 'Added ✓' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

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
        {/*     <svg width="120" height="120" viewBox="0 0 100 100" fill="none" stroke="#8bb56e" strokeWidth="1.5">
              <path d="M50 10 C70 30 80 55 50 90 C20 55 30 30 50 10 Z" />
              <path d="M50 10 L50 90" strokeWidth="1" strokeDasharray="3,3" />
              <path d="M50 30 Q65 35 75 25" strokeWidth="0.8" />
              <path d="M50 45 Q35 50 25 40" strokeWidth="0.8" />
              <path d="M50 60 Q65 65 70 55" strokeWidth="0.8" />
            </svg> */}
          </div>

          <div className="absolute top-[40%] right-[6%] pointer-events-none z-10 opacity-25 hidden lg:block">
            {/* <svg width="160" height="160" viewBox="0 0 100 100" fill="none" stroke="#8bb56e" strokeWidth="1">
              <path d="M50 10 C75 35 70 70 50 90 C30 70 25 35 50 10 Z" />
              <path d="M50 10 Q50 50 50 90" />
              <path d="M50 35 Q68 40 72 30" />
              <path d="M50 55 Q32 60 28 50" />
            </svg> */}
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
            <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-[auto_auto_auto] md:gap-y-2 border-y border-[#1b261b]/10 bg-white">
              {/* Card 1 */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-[#1b261b]/10 text-left md:row-span-3 md:grid md:grid-rows-subgrid">
                <span className="text-[#1b261b] text-3xl lg:text-4xl font-bold tracking-tight block mb-4 md:mb-0">Direct-from-Garden</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2 md:mb-0">No Auction Middlemen</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  We source straight from small tea estates and growers, cutting out auction houses so more value reaches the people who actually grow the leaf.
                </p>
              </div>

              {/* Card 2 */}
              <div className="p-8 border-b md:border-b-0 md:border-r border-[#1b261b]/10 text-left md:row-span-3 md:grid md:grid-rows-subgrid">
                <span className="text-[#1b261b] text-3xl lg:text-4xl font-bold tracking-tight block mb-4 md:mb-0">Single-Origin</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2 md:mb-0">Darjeeling Sourced</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  Every batch comes from identified gardens in the Darjeeling hills — not blended, not anonymous. You'll know exactly where your tea is from.
                </p>
              </div>

              {/* Card 3 */}
              <div className="p-8 text-left md:row-span-3 md:grid md:grid-rows-subgrid">
                <span className="text-[#1b261b] text-3xl lg:text-4xl font-bold tracking-tight block mb-4 md:mb-0">Freshly Packed</span>
                <h4 className="text-base font-bold text-[#1b261b] mb-2 md:mb-0">Harvest to Doorstep</h4>
                <p className="text-xs text-[#4a584a] leading-relaxed">
                  We ship close to harvest instead of sitting in warehouses for months, so what you get is closer to how it tasted in the garden.
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
          <section className="px-6 md:px-12 lg:px-16 pb-32 max-w-[1360px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">

              <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
                {/* Background Image with Light Hover Effect */}
                <img 
                  src="/origin.webp" 
                  alt="Origin" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Slight Black Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />

                {/* Text Content */}
                <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">Origin</h3>
                  <p className="text-white/85 text-sm leading-relaxed">
                    From the highland terraces of Darjeeling to the ancient gardens
                    of Uji, we partner directly with generational growers who share
                    our obsession with terroir and seasonal harvests.
                  </p>
                </div>
              </div>

              <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
                {/* Background Image with Light Hover Effect */}
                <img 
                  src="/craft.webp" 
                  alt="Craft" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Slight Black Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />

                {/* Text Content */}
                <div className="relative z-10 md:min-h-[170px] lg:min-h-[145px] flex flex-col justify-start">
                  <h3 className="text-white text-xl font-bold uppercase tracking-wide mb-3">Craft</h3>
                  <p className="text-white/85 text-sm leading-relaxed">
                    Every batch is hand-rolled, shade-dried, and slow-oxidized
                    under the guidance of our tea masters. No shortcuts, no
                    mechanized blending — just centuries-old technique.
                  </p>
                </div>
              </div>

              <div className="group relative p-8 md:p-10 rounded-2xl border border-white/10 bg-black min-h-[420px] md:min-h-[500px] lg:min-h-[540px] flex flex-col justify-end overflow-hidden transition-all duration-500">
                {/* Background Image with Light Hover Effect */}
                <img 
                  src="/experience.webp" 
                  alt="Experience" 
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />
                {/* Slight Black Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent pointer-events-none" />

                {/* Text Content */}
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

            {/* Showcase Image 2 (Full Viewport Width Edge-to-Edge) */}
            <div className="w-full overflow-hidden relative">
              <img
                src="/tea1_1.png"
                alt="Ember Charm Tea Canister"
                className="w-full h-auto block object-cover"
              />
              {/* Stronger blur gradient overlay at the bottom for smooth transition to light background */}
              <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-[#f9faf7]/60 to-transparent pointer-events-none backdrop-blur-[1px]" />
            </div>

            {/* ── Products Section ── */}
            <section className="px-6 md:px-12 lg:px-16 py-32 max-w-[1360px] mx-auto bg-[#f9faf7]">
              <div className="text-center max-w-2xl mx-auto mb-16 md:mb-24">
                <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">Signature Blends</span>
                <h2 className="text-[#1b261b] text-3xl md:text-4xl lg:text-5xl font-sans font-bold tracking-tight mb-6">Our Collections</h2>
                <p className="text-[#4a584a] text-sm md:text-base leading-relaxed">
                  Hand-selected whole leaf teas sourced directly from estate gardens and packaged to preserve complex terroir and freshness.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
                <ProductCard
                  id="ember-charm"
                  name="Ember Charm"
                  price={28}
                  description="A deeply oxidized roasted oolong tea layered with warm cinnamon wood, dark cacao, and roasted chestnut notes. Perfect for slow, contemplative afternoons."
                  imageSrc="/embercharm.webp"
                />
                <ProductCard
                  id="morning-dew"
                  name="Morning Dew"
                  price={24}
                  description="Ethereal first-flush green tea leaves hand-harvested at dawn and naturally scented with night-blooming jasmine flowers. Bright, floral, and clarifying."
                  imageSrc="/morningdew.webp"
                />
                <ProductCard
                  id="summer-breeze"
                  name="Summer Breeze"
                  price={26}
                  description="A delicate sun-dried white peony tea balanced with organic lemongrass and sun-ripened citrus peels. Refreshing, crisp, and clean."
                  imageSrc="/summerbreeze.webp"
                />
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
               {/*  <svg
                  viewBox="0 0 100 100"
                  className="w-6 h-6 fill-none stroke-current text-[#8bb56e]"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M50 20 C65 35 75 55 50 80 C25 55 35 35 50 20 Z" />
                  <path d="M50 20 C50 40 50 60 50 80" strokeWidth="1.5" />
                </svg> */}
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
