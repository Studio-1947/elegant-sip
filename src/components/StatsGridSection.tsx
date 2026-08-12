export default function StatsGridSection() {
  return (
    <section className="px-6 md:px-16 lg:px-24 pb-10 max-w-6xl mx-auto">
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
  )
}
