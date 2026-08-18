import { useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Link } from '../lib/router'
import { useUi } from './UiContext'

gsap.registerPlugin(useGSAP, ScrollTrigger)
import HeroIntroSection from './HeroIntroSection'
import StatsGridSection from './StatsGridSection'
import HarvestShowcaseSection from './HarvestShowcaseSection'
import ThreePillarsSection from './ThreePillarsSection'
import CanisterShowcaseSection from './CanisterShowcaseSection'
import ProductsSection from './ProductsSection'
import PackageShowcaseSection from './PackageShowcaseSection'
import TestimonialsSection from './TestimonialsSection'
import PhilosophyQuoteSection from './PhilosophyQuoteSection'
import StatsBarSection from './StatsBarSection'
import NewsletterSection from './NewsletterSection'
import Footer from './Footer'

const TICKER_ITEMS = ['Direct from Garden', 'Single-Origin', 'Freshly Packed', 'Small-Batch Craft']

function TickerStrip() {
  // Track holds two copies of the list; the animation slides -50% for a seamless loop.
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS]
  return (
    <div className="overflow-hidden bg-[#f9faf7] border-b border-[#1b261b]/10 py-4" aria-hidden="true">
      <div className="ticker-track flex w-max items-center">
        {items.map((item, i) => (
          <span key={`${item}-${i}`} className="flex items-center">
            <span className="text-[#8bb56e] text-[11px] font-mono font-bold tracking-[0.25em] uppercase whitespace-nowrap px-6">
              {item}
            </span>
            <span className="w-px h-3.5 bg-[#1b261b]/15" />
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * MobileScrubHero — the portrait scroll animation. A sticky full-screen video
 * whose playhead is scrubbed by scroll (all-intra encode, so every frame seeks
 * instantly), with the hero copy fading out as the journey begins. Falls back
 * to a static poster hero for prefers-reduced-motion.
 */
function MobileScrubHero({ openQuiz, onJourneyDone }: { openQuiz: () => void; onJourneyDone: (done: boolean) => void }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useGSAP(
    () => {
      if (reduced) {
        // No scrub journey to finish — unlock dependent UI right away.
        onJourneyDone(true)
        return
      }
      const video = videoRef.current
      const section = sectionRef.current
      if (!video || !section) return

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate: (self) => {
            onJourneyDone(self.progress > 0.95)
          },
        },
      })
      const addScrub = () => {
        if (video.duration && video.duration > 0) {
          tl.fromTo(video, { currentTime: 0 }, { currentTime: video.duration, ease: 'none' }, 0)
        }
      }
      video.addEventListener('loadedmetadata', addScrub)
      if (video.readyState >= 1) addScrub()

      // Fade the hero copy out over the first stretch of the journey, and
      // drop its hit-target once it's mostly gone so the video can be enjoyed.
      if (overlayRef.current) {
        const overlay = overlayRef.current
        gsap.to(overlay, {
          opacity: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: '+=55%',
            scrub: true,
            onUpdate: (self) => {
              overlay.style.pointerEvents = self.progress > 0.5 ? 'none' : 'auto'
            },
          },
        })
      }

      return () => video.removeEventListener('loadedmetadata', addScrub)
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  return (
    <section ref={sectionRef} className={`relative ${reduced ? 'h-[86svh] min-h-[540px]' : 'h-[320vh]'}`}>
      <div className={`${reduced ? 'absolute inset-0' : 'sticky top-0 h-[100svh]'} w-full overflow-hidden bg-[#1b261b]`}>
        {reduced ? (
          <img
            src="/mobile-poster.webp"
            alt="Illustrated tea hills of Darjeeling at first light"
            className="absolute inset-0 w-full h-full object-cover"
            fetchPriority="high"
          />
        ) : (
          <video
            ref={videoRef}
            src="/mobile_video.mp4"
            poster="/mobile-poster.webp"
            className="absolute inset-0 w-full h-full object-cover"
            muted
            playsInline
            preload="auto"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/10 pointer-events-none" />

        {/* Hero copy overlay */}
        <div ref={overlayRef}>
          {/* Wordmark */}
          <span className="absolute top-[13%] left-1/2 -translate-x-1/2 text-white text-4xl font-bold uppercase tracking-tight whitespace-nowrap drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
            Elegant Sip
          </span>

          {/* Copy + CTAs */}
          <div className="absolute bottom-10 left-6 right-6">
            <span className="text-[#8bb56e] text-[11px] font-mono font-bold tracking-[0.3em] uppercase block mb-3">
              Single-Origin Darjeeling
            </span>
            <h1 className="text-white text-[2.35rem] font-bold leading-[1.1] tracking-tight mb-7">
              From mist-covered hills to your cup.
            </h1>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/shop"
                className="bg-[#8bb56e] hover:bg-[#9cc580] text-[#12240f] text-sm font-semibold py-3.5 px-6 rounded-full transition-colors"
              >
                Shop the collection
              </Link>
              <button
                onClick={openQuiz}
                className="border border-white/50 hover:border-white text-white text-sm font-semibold py-3.5 px-6 rounded-full transition-colors cursor-pointer"
              >
                Taste Matcher
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/**
 * MobileHome — the phone-first homepage: scroll-scrubbed portrait video hero
 * followed by a linear flow of the shared content sections.
 */
export default function MobileHome() {
  const { openQuiz } = useUi()
  // The floating quiz pill stays hidden until the scroll animation has played through.
  const [journeyDone, setJourneyDone] = useState(false)

  return (
    <div className="bg-[#f9faf7] pt-20">
      <MobileScrubHero
        openQuiz={openQuiz}
        onJourneyDone={(done) => setJourneyDone((prev) => (prev === done ? prev : done))}
      />

      {/* ── Marquee ── */}
      <TickerStrip />

      {/* ── Brew elegance banner ── */}
      <section className="relative">
        <img src="/hero.webp" alt="Tea plantation in the hills" loading="lazy" width={1920} height={1172} className="w-full h-72 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
        <h2 className="absolute bottom-6 left-6 right-6 text-white text-xl font-bold uppercase tracking-wide">
          Brew Elegance | Sip Luxury
        </h2>
      </section>

      {/* ── Shared content sections (each carries its own mobile layout) ── */}
      <HeroIntroSection />
      <StatsGridSection />
      <HarvestShowcaseSection />
      <ThreePillarsSection />
      <CanisterShowcaseSection />
      <ProductsSection />
      <PackageShowcaseSection />
      <TestimonialsSection />
      <PhilosophyQuoteSection />
      <StatsBarSection />
      <NewsletterSection />
      <Footer />

      {/* ── Floating Taste Matcher pill (appears after the scroll animation) ── */}
      {journeyDone && (
      <button
        onClick={openQuiz}
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-white/95 backdrop-blur-md border border-[#1b261b]/10 rounded-full pl-2 pr-5 py-2 shadow-[0_8px_30px_rgba(27,38,27,0.15)] cursor-pointer animate-fade-in"
      >
        <span className="w-9 h-9 rounded-full bg-[#8bb56e]/15 flex items-center justify-center text-[#8bb56e]">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zm7 12l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6z" />
          </svg>
        </span>
        <span className="text-left">
          <span className="block text-[11px] font-mono font-bold tracking-wider uppercase text-[#1b261b]">Taste Matcher</span>
          <span className="block text-[11px] text-[#4a584a]">Find your perfect cup in 10s</span>
        </span>
      </button>
      )}
    </div>
  )
}
