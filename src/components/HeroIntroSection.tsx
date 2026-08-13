import { useScrollReveal } from '../lib/useScrollReveal'

export default function HeroIntroSection() {
  const ref = useScrollReveal<HTMLElement>({ target: ':scope > *' })

  return (
    <section ref={ref} className="px-6 md:px-16 lg:px-24 pt-16 pb-24 max-w-6xl mx-auto text-center">
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
  )
}
