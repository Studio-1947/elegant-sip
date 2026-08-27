import ScrollExpand from './ScrollExpand'
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
import TrustBadgesSection from './TrustBadgesSection'
import NewsletterSection from './NewsletterSection'
import Footer from './Footer'

/**
 * HeroScrollSection
 *
 * The cinematic section that replaces the post-parallax black screen.
 * Uses ScrollExpand for full-screen pinned expand with a rich component-based content reveal.
 */
export default function HeroScrollSection() {
  return (
    <div className="relative bg-black">
      {/* ── Primary: window-pinned expand with content reveal ── */}
      <ScrollExpand
        src="/hero-1920.webp"
        alt="Hand-picked single-origin Darjeeling tea leaves at an Elegant Sip garden"
        title="Single-Origin Darjeeling Tea"
        scrollHint="Scroll"
        useWindowScroll
      >
        {/* Content revealed after the frame fully expands (Light Theme) */}
        <div className="relative z-20 bg-[#f9faf7] overflow-hidden">
          {/* Gradient transition from transparent video to solid light paper */}
          <div className="h-32 bg-gradient-to-b from-transparent to-[#f9faf7]" />

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
          <TrustBadgesSection />
          <NewsletterSection />
          <Footer />
        </div>
      </ScrollExpand>
    </div>
  )
}
