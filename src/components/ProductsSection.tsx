import ProductCard from './ProductCard'

export default function ProductsSection() {
  return (
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
  )
}
