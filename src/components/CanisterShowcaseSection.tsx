import { useScrollReveal } from '../lib/useScrollReveal'

export default function CanisterShowcaseSection() {
  const textOverlayRef = useScrollReveal<HTMLDivElement>()

  return (
    <div className="w-full overflow-hidden relative">
      {/* Phone: text block above the image */}
      <div className="md:hidden px-6 pt-4 pb-10 bg-[#f9faf7]">
        <span className="text-[#8bb56e] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
          Single Origin
        </span>
        <h2 className="text-[#1b261b] text-4xl font-bold uppercase tracking-tight leading-[1.1] mb-4">
          Darjeeling's<br />
          <span className="text-[#8bb56e]">Finest</span>
        </h2>
        <p className="text-[#4a584a] text-sm leading-relaxed">
          Harvested from high-altitude estates in the mist-shrouded Darjeeling hills. Hand-plucked, gently processed, and curated to preserve the delicate, signature muscatel flavor profile in every cup.
        </p>
      </div>

      <img
        src="/tea1_1.webp"
        alt="Ember Charm Tea Canister"
        loading="lazy"
        width={2560}
        height={1440}
        className="w-full h-auto block object-cover"
      />

      {/* Desktop: text overlay on the left side */}
      <div
        ref={textOverlayRef}
        className="hidden md:block absolute left-[6%] md:left-[10%] top-[10%] sm:top-[15%] md:top-[20%] max-w-[45%] sm:max-w-[40%] text-left z-10 select-none"
      >
        <span className="text-[#8bb56e] text-[10px] sm:text-xs md:text-sm font-mono tracking-[0.3em] uppercase block mb-1 sm:mb-2 md:mb-4">
          Single Origin
        </span>
        <h2 className="text-[#1b261b] text-xl sm:text-2xl md:text-5xl lg:text-6xl font-bold uppercase tracking-tight leading-[1.1] mb-2 sm:mb-4 md:mb-6">
          Darjeeling's<br />
          <span className="text-[#8bb56e]">Finest</span>
        </h2>
        <p className="text-[#4a584a] text-[10px] sm:text-xs md:text-sm leading-relaxed font-light hidden sm:block max-w-sm">
          Harvested from high-altitude estates in the mist-shrouded Darjeeling hills. Hand-plucked, gently processed, and curated to preserve the delicate, signature muscatel flavor profile in every cup.
        </p>
      </div>

      {/* Bottom gradient into the light background. The photo's arm is hard-cut at the image's
          bottom edge, so the lower part of the gradient must be FULLY solid to swallow that cut —
          a translucent fade lets the dark sleeve ghost through. Solid up to ~45%, then fade. */}
      <div className="md:hidden absolute -bottom-px left-0 right-0 h-28 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none" />

      {/* Desktop version — taller, same solid-then-fade recipe so the arm cut never ghosts through */}
      <div className="hidden md:block absolute -bottom-px left-0 right-0 h-64 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none backdrop-blur-[1px]" />
    </div>
  )
}
