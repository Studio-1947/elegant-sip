import { useScrollReveal } from '../lib/useScrollReveal'
import SkeletonImage from './SkeletonImage'

const EYEBROW = 'Single Origin'
const PARAGRAPH =
  'Harvested from high-altitude estates in the mist-shrouded Darjeeling hills. Hand-plucked, gently processed, and curated to preserve the delicate, signature muscatel flavor profile in every cup.'

function Heading({ className }: { className: string }) {
  return (
    <h2 className={className}>
      Darjeeling's<br />
      <span className="text-[#8bb56e]">Finest</span>
    </h2>
  )
}

export default function CanisterShowcaseSection() {
  const textOverlayRef = useScrollReveal<HTMLDivElement>()

  return (
    <div className="w-full overflow-hidden">
      {/* ── Phone: text stacked above the full image ── */}
      <div className="md:hidden">
        <div className="px-6 pt-4 pb-10 bg-[#f9faf7]">
          <span className="text-[#8bb56e] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
            {EYEBROW}
          </span>
          <Heading className="text-[#1b261b] text-4xl font-bold uppercase tracking-tight leading-[1.1] mb-4" />
          <p className="text-[#4a584a] text-sm leading-relaxed">{PARAGRAPH}</p>
        </div>
        <div className="relative">
          <SkeletonImage
            src="/tea1_1.webp"
            alt="Ember Charm Tea Canister"
            loading="lazy"
            width={2560}
            height={1440}
            className="w-full h-auto block object-cover"
          />
          {/* Solid-then-fade gradient — swallows the photo's hard-cut arm at the bottom edge */}
          <div className="absolute -bottom-px left-0 right-0 h-28 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none" />
        </div>
      </div>

      {/* ── Tablet: side-by-side, text left / jar right ── */}
      <div className="hidden md:grid lg:hidden grid-cols-[44%_56%] items-center gap-8 px-10 py-10 bg-[#f9faf7]">
        <div>
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
            {EYEBROW}
          </span>
          <Heading className="text-[#1b261b] text-5xl font-bold uppercase tracking-tight leading-[1.1] mb-5" />
          <p className="text-[#4a584a] text-sm leading-relaxed max-w-sm">{PARAGRAPH}</p>
        </div>
        <div className="relative rounded-2xl overflow-hidden">
          <SkeletonImage
            src="/tea1_1.webp"
            alt="Ember Charm Tea Canister"
            loading="lazy"
            className="w-full h-[26rem] object-cover object-[62%_35%]"
          />
          <div className="absolute -bottom-px left-0 right-0 h-36 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none" />
        </div>
      </div>

      {/* ── Desktop: full-bleed image with text overlay ── */}
      <div className="hidden lg:block relative">
        <SkeletonImage
          src="/tea1_1.webp"
          alt="Ember Charm Tea Canister"
          loading="lazy"
          width={2560}
          height={1440}
          className="w-full h-auto block object-cover"
        />
        <div
          ref={textOverlayRef}
          className="absolute left-[10%] top-[20%] max-w-[40%] text-left z-10 select-none"
        >
          <span className="text-[#8bb56e] text-sm font-mono tracking-[0.3em] uppercase block mb-4">
            {EYEBROW}
          </span>
          <Heading className="text-[#1b261b] text-5xl xl:text-6xl font-bold uppercase tracking-tight leading-[1.1] mb-6" />
          <p className="text-[#4a584a] text-sm leading-relaxed font-light max-w-sm">{PARAGRAPH}</p>
        </div>
        {/* Solid-then-fade gradient with a subtle blur — swallows the photo's hard-cut arm */}
        <div className="absolute -bottom-px left-0 right-0 h-64 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none backdrop-blur-[1px]" />
      </div>
    </div>
  )
}
