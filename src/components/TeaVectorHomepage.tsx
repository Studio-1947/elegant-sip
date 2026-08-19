import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import HomeExperience from './HomeExperience'
import ConsentBanner from './ConsentBanner'
import SiteHeader from './SiteHeader'
import LoadingOverlay from './LoadingOverlay'
import PageSkeleton from './PageSkeleton'
import Footer from './Footer'
import { useHashRoute, parseRoute, getRoute } from '../lib/router'
import { useIsCompact } from '../lib/useMediaQuery'
import { getVideoProgress } from '../lib/videoLoading'
import { setLenis } from '../lib/scroll'

// Non-home routes are code-split: each loads on demand with a skeleton page
// as the Suspense fallback. The home experience stays in the main bundle.
const ShopPage = lazy(() => import('./ShopPage'))
const ProductDetailPage = lazy(() => import('./ProductDetailPage'))
const CartPage = lazy(() => import('./CartPage'))
const CheckoutPage = lazy(() => import('./CheckoutPage'))
const WishlistPage = lazy(() => import('./WishlistPage'))
const AboutPage = lazy(() => import('./AboutPage'))
const JournalPage = lazy(() => import('./JournalPage'))
const JournalArticlePage = lazy(() => import('./JournalPage').then((m) => ({ default: m.JournalArticlePage })))
const FaqPage = lazy(() => import('./FaqPage'))
const ContactPage = lazy(() => import('./ContactPage'))
const OrderPage = lazy(() => import('./OrderPage'))
const AccountPage = lazy(() => import('./AccountPage'))
const BrewingGuidePage = lazy(() => import('./BrewingGuidePage'))
const GardensPage = lazy(() => import('./GardensPage'))
const PrivacyPage = lazy(() => import('./legal/PrivacyPage'))
const TermsPage = lazy(() => import('./legal/TermsPage'))
const ShippingReturnsPage = lazy(() => import('./legal/ShippingReturnsPage'))
const NotFoundPage = lazy(() => import('./NotFoundPage'))

gsap.registerPlugin(ScrollTrigger)

export default function TeaVectorHomepage() {
  const route = useHashRoute()
  const { name: routeName, id: routeId } = parseRoute(route)
  const isHome = routeName === 'home'

  const [loadingPercentage, setLoadingPercentage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fadeLoader, setFadeLoader] = useState(false)
  // Quantized scrub state: only the threshold the header cares about.
  // Storing raw progress here would re-render the whole app shell every frame.
  const [scrub, setScrub] = useState({ past95: false })

  // Loader: holds until the hero video is actually buffered enough to scrub,
  // showing REAL download progress. Escape hatches so nobody is ever trapped:
  // buffering stall (browser chose partial preload — the clamped scrub handles
  // the rest), video error, or a 25s hard cap. Only the homepage has a video;
  // every other route paints immediately. Reduced-motion skips it entirely.
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const home = parseRoute(getRoute()).name === 'home'
    if (reduced || !home) {
      setLoading(false)
      return
    }
    const start = Date.now()
    let lastValue = 0
    let lastChange = Date.now()
    let fadeTimer: number | undefined
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearInterval(poll)
      setLoadingPercentage(100)
      setFadeLoader(true)
      fadeTimer = window.setTimeout(() => setLoading(false), 900)
    }
    const poll = window.setInterval(() => {
      const fraction = getVideoProgress()
      if (fraction > lastValue) {
        lastValue = fraction
        lastChange = Date.now()
      }
      setLoadingPercentage(Math.round(Math.min(fraction, 0.99) * 100))
      const elapsed = Date.now() - start
      // Stall covers the never-started case too: iOS Safari may not buffer at
      // all until playback is primed — without this, iPhones sat on the loader
      // until the hard cap. The buffered-clamped scrub handles whatever's left.
      const stalled = Date.now() - lastChange > (lastValue > 0 ? 5000 : 4000)
      if ((fraction >= 0.99 && elapsed > 1600) || stalled || elapsed > 25000) finish()
    }, 150)
    return () => {
      window.clearInterval(poll)
      if (fadeTimer) window.clearTimeout(fadeTimer)
    }
  }, [])

  // Initialize Lenis smooth scroll synced to GSAP ticker (skipped for reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      // Touch stays native: syncTouch re-drives touch scrolling through JS
      // every frame, which reads as lag on mid-range phones — especially
      // while the hero video is being scrubbed.
      syncTouch: false,
    })
    setLenis(lenis)

    lenis.on('scroll', ScrollTrigger.update)
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      setLenis(null)
    }
  }, [])

  // Reset scrub progress on any route change so the header returns to its
  // centered/transparent state when landing back on the home experience.
  useEffect(() => {
    setScrub({ past95: false })
  }, [route])

  const isCompact = useIsCompact()

  // Header chrome derived from scrub progress or non-home routes.
  // Below lg the navbar is always engaged — the compact home has no video intro
  // that the header needs to stay out of the way for.
  const isNavbar = !isHome || scrub.past95 || isCompact

  const handleProgress = (progress: number) => {
    const past95 = progress > 0.95
    // Bail out unless the threshold was actually crossed — this runs every scroll frame.
    setScrub((s) => (s.past95 === past95 ? s : { past95 }))
  }

  let page: ReactNode
  switch (routeName) {
    case 'shop':
      page = <ShopPage />
      break
    case 'product':
      page = <ProductDetailPage id={routeId} />
      break
    case 'cart':
      page = <CartPage />
      break
    case 'checkout':
      page = <CheckoutPage />
      break
    case 'wishlist':
      page = <WishlistPage />
      break
    case 'about':
      page = <AboutPage />
      break
    case 'journal':
      page = routeId ? <JournalArticlePage id={routeId} /> : <JournalPage />
      break
    case 'faq':
      page = <FaqPage />
      break
    case 'contact':
      page = <ContactPage />
      break
    case 'order':
      page = <OrderPage id={routeId} />
      break
    case 'account':
      page = <AccountPage />
      break
    case 'brewing':
      page = <BrewingGuidePage />
      break
    case 'gardens':
      page = <GardensPage />
      break
    case 'privacy':
      page = <PrivacyPage />
      break
    case 'terms':
      page = <TermsPage />
      break
    case 'shipping':
      page = <ShippingReturnsPage />
      break
    case 'home':
      page = <HomeExperience ready={!loading} onProgress={handleProgress} />
      break
    default:
      page = <NotFoundPage />
  }

  return (
    <div className="relative bg-black min-h-screen">
      {/* Accessibility skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-[#1b261b] focus:px-5 focus:py-3 focus:rounded-lg focus:text-xs focus:font-bold focus:shadow-lg"
      >
        Skip to content
      </a>

      {loading && <LoadingOverlay percentage={loadingPercentage} fading={fadeLoader} />}

      {!loading && <SiteHeader isNavbar={isNavbar} routeName={routeName} route={route} />}

      {/* Main content */}
      <main id="main-content" className="relative z-20">
        <Suspense fallback={<PageSkeleton />}>{page}</Suspense>
      </main>

      {/* App-level footer for non-home pages */}
      {!isHome && (
        <div className="relative z-10">
          <Footer />
        </div>
      )}

      <ConsentBanner />
    </div>
  )
}
