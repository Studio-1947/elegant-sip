import { useScrollReveal } from '../lib/useScrollReveal'
import SkeletonImage from './SkeletonImage'
import BlurText from './BlurText'
import { Link } from '../lib/router'

const EYEBROW = 'Single Origin'
const PARAGRAPH =
  'Harvested from high-altitude estates in the mist-shrouded Darjeeling hills. Hand-plucked, gently processed, and curated to preserve the delicate, signature muscatel flavor profile in every cup.'

/** Phones get a tighter version — the full paragraph is a wall of text at 390px. */
const PARAGRAPH_SHORT =
  'Hand-plucked in the Darjeeling hills and gently processed, so the signature muscatel character reaches your cup intact.'

/** The year in three pickings — left, front, right of the fanned stack. */
const FLUSHES = [
  { src: '/products/second-flush.webp', season: 'Summer', position: 'left-1 -translate-y-1/2 -rotate-[7deg] origin-bottom-right', label: 'left-2' },
  { src: '/products/whole-leaf-first-flush.webp', season: 'Spring', position: 'left-1/2 -translate-x-1/2 -translate-y-[54%] z-10', label: 'left-2' },
  { src: '/products/third-flush.webp', season: 'Autumn', position: 'right-1 -translate-y-1/2 rotate-[7deg] origin-bottom-left', label: 'right-2' },
]

/** Only claims the site already makes elsewhere. */
const POINTS = [
  { label: 'Hand-plucked', icon: 'M12 21c-4.5-3-7.5-6.5-7.5-10.5A7.5 7.5 0 0112 3a7.5 7.5 0 017.5 7.5C19.5 14.5 16.5 18 12 21zm0-14v8' },
  { label: 'Small lots', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m16.5 0h-16.5m16.5 0l-1.5-3h-13.5l-1.5 3M10 11.25h4' },
  { label: 'Packed to order', icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9' },
]

function Heading({ className }: { className: string }) {
  return (
    <h2 className={className}>
      <BlurText as="span" text="Darjeeling's" delay={120} />
      <BlurText as="span" text="Finest" delay={120} className="text-[#4a7333]" />
    </h2>
  )
}

export default function CanisterShowcaseSection() {
  const textOverlayRef = useScrollReveal<HTMLDivElement>()

  return (
    <div className="w-full overflow-hidden">
      {/* ── Phone: the three flushes fanned out, then the story and a way in.
             (The canister photo shows retired packaging and is desktop/tablet-only.) ── */}
      <div className="md:hidden px-6 pt-6 pb-14 bg-[#f9faf7]">
        <div className="relative h-[19rem] mb-8" aria-hidden="true">
          {FLUSHES.map((f, i) => (
            <div
              key={f.src}
              className={`absolute top-1/2 w-[46%] max-w-[13rem] rounded-2xl overflow-hidden shadow-[0_18px_40px_rgba(27,38,27,0.18)] ${f.position}`}
            >
              <SkeletonImage src={f.src} alt="" loading="lazy" width={1600} height={1600} sizes="48vw" className="w-full aspect-[4/5] object-cover" />
              <span className={`absolute bottom-2 ${f.label} bg-white/90 text-[#1b261b] text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-1 rounded-md`}>
                {f.season}
              </span>
              {i !== 1 && <span className="absolute inset-0 bg-[#f9faf7]/10" />}
            </div>
          ))}
        </div>

        <span className="text-[#4a7333] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
          {EYEBROW}
        </span>
        <Heading className="text-[#1b261b] text-4xl font-bold uppercase tracking-tight leading-[1.05] mb-4" />
        <p className="text-[#4a584a] text-[15px] leading-relaxed mb-6">{PARAGRAPH_SHORT}</p>

        <ul className="grid grid-cols-3 gap-2 mb-7">
          {POINTS.map((point) => (
            <li key={point.label} className="flex flex-col items-center text-center gap-2 bg-white border border-[#1b261b]/10 rounded-xl px-2 py-3">
              <svg className="w-5 h-5 text-[#4a7333]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={point.icon} />
              </svg>
              <span className="text-[11px] font-semibold text-[#1b261b] leading-tight">{point.label}</span>
            </li>
          ))}
        </ul>

        <Link
          to="/shop"
          className="flex items-center justify-center gap-2 w-full h-12 rounded-xl bg-[#1b261b] text-white text-xs font-bold tracking-widest uppercase active:scale-[0.99] transition-transform"
        >
          Explore the range
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>

      {/* ── Tablet: side-by-side, text left / jar right ── */}
      <div className="hidden md:grid lg:hidden grid-cols-[44%_56%] items-center gap-8 px-10 py-10 bg-[#f9faf7]">
        <div>
          <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-3">
            {EYEBROW}
          </span>
          <Heading className="text-[#1b261b] text-5xl font-bold uppercase tracking-tight leading-[1.1] mb-5" />
          <p className="text-[#4a584a] text-sm leading-relaxed max-w-sm">{PARAGRAPH}</p>
        </div>
        <div className="relative rounded-2xl overflow-hidden">
          <SkeletonImage
            src="/tea1_1.webp"
            alt="Elegant Sip first flush Darjeeling tea canister"
            loading="lazy"
            width={2560}
            height={1440}
            className="w-full h-[26rem] object-cover object-[62%_35%]"
          />
          <div className="absolute -bottom-px left-0 right-0 h-36 bg-gradient-to-t from-[#f9faf7] via-[#f9faf7] via-45% to-transparent pointer-events-none" />
        </div>
      </div>

      {/* ── Desktop: full-bleed image with text overlay ── */}
      <div className="hidden lg:block relative">
        <SkeletonImage
          src="/tea1_1.webp"
          alt="Elegant Sip first flush Darjeeling tea canister"
          loading="lazy"
          width={2560}
          height={1440}
          className="w-full h-auto block object-cover"
        />
        <div
          ref={textOverlayRef}
          className="absolute left-[10%] top-[20%] max-w-[40%] text-left z-10 select-none"
        >
          <span className="text-[#4a7333] text-sm font-mono tracking-[0.3em] uppercase block mb-4">
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
