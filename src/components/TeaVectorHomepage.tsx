import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import ConsentBanner from './ConsentBanner'
import SiteHeader from './SiteHeader'
import LoadingOverlay from './LoadingOverlay'
import PageSkeleton from './PageSkeleton'
import Footer from './Footer'
import { useRoute, parseRoute, getRoute } from '../lib/router'
import { useIsCompact } from '../lib/useMediaQuery'
import { getVideoProgress } from '../lib/videoLoading'
import { setLenis } from '../lib/scroll'

// Non-home routes are code-split: each loads on demand with a skeleton page
// as the Suspense fallback. The home experience stays in the main bundle.
const HomeExperience = lazy(() => import('./HomeExperience'))
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

export default function TeaVectorHomepage() {
  const route = useRoute()
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
      // Release at 15% buffered rather than fully buffered: seeks are already
      // clamped to the buffered range, so the playhead simply trails the
      // download instead of the visitor staring at an opaque loader.
      const enoughBuffered = fraction >= 0.15 && elapsed > 1200
      if (enoughBuffered || stalled || elapsed > 10000) finish()
    }, 150)
    return () => {
      window.clearInterval(poll)
      if (fadeTimer) window.clearTimeout(fadeTimer)
    }
  }, [])

  /*
   * Smooth scroll, loaded AFTER first paint.
   *
   * GSAP + Lenis are ~138 KB. Imported statically at the top of the app shell
   * they sat in the critical path of every route — a text-only page like /faq
   * spent 430 ms of CPU parsing an animation library it never uses. Loading
   * them dynamically here takes them off the first-paint path entirely; smooth
   * scroll simply engages a moment later, which is imperceptible because the
   * page cannot be scrolled before it has painted.
   */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let cancelled = false
    let teardown: (() => void) | undefined

    void (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
        import('lenis'),
      ])
      // The component may have unmounted while the chunk was in flight.
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

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
      // Named so cleanup can remove it. An anonymous callback here leaks: under
      // StrictMode it keeps firing 60×/s against a destroyed Lenis instance.
      const tick = (time: number) => lenis.raf(time * 1000)
      gsap.ticker.add(tick)
      gsap.ticker.lagSmoothing(0)

      teardown = () => {
        gsap.ticker.remove(tick)
        // Restore GSAP's default lag smoothing — it is a global mutation.
        gsap.ticker.lagSmoothing(500, 33)
        lenis.destroy()
        setLenis(null)
      }
    })()

    return () => {
      cancelled = true
      teardown?.()
    }
  }, [])

  // Reset scrub progress on any route change so the header returns to its
  // centered/transparent state when landing back on the home experience.
  useEffect(() => {
    setScrub({ past95: false })
  }, [route])

  // Announce navigation to screen readers: a client-side route change is
  // otherwise completely silent.
  const [announcement, setAnnouncement] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnnouncement(document.title ? `${document.title} — page loaded` : 'Page loaded')
    }, 400)
    return () => window.clearTimeout(timer)
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

  // The router owns the hash, so an `href="#main-content"` skip link would be
  // parsed as a route and 404. Move focus directly instead.
  const skipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const main = document.getElementById('main-content')
    if (!main) return
    main.focus()
    main.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="relative bg-black min-h-screen">
      {/* Accessibility skip link */}
      <a
        href="#main-content"
        onClick={skipToContent}
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-[#1b261b] focus:px-5 focus:py-3 focus:rounded-lg focus:text-xs focus:font-bold focus:shadow-lg"
      >
        Skip to content
      </a>

      {loading && <LoadingOverlay percentage={loadingPercentage} fading={fadeLoader} />}

      {/* Rendered even while the loader is up (which overlays it), so the nav
          links exist in the DOM at t=0 for crawlers and assistive tech. */}
      <SiteHeader isNavbar={isNavbar} routeName={routeName} route={route} />

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="relative z-20 outline-none">
        {/* The home fallback must reserve the hero's full viewport height in
            the brand's dark green. A generic PageSkeleton here is a different
            height, and the swap to the real hero registered as layout shift
            (CLS 0.16) — which costs more than the lazy chunk saves. */}
        <Suspense
          fallback={
            isHome ? (
              <div className="min-h-screen bg-[#1b261b]" aria-busy="true" aria-label="Loading" />
            ) : (
              <PageSkeleton />
            )
          }
        >
          {page}
        </Suspense>
      </main>

      {/* App-level footer for non-home pages */}
      {!isHome && (
        <div className="relative z-10">
          <Footer />
        </div>
      )}

      <ConsentBanner />

      {/* Route-change announcer — present from mount so updates are spoken. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
