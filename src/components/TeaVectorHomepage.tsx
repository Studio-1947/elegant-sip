import { useEffect, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import HomeExperience from './HomeExperience'
import CartPage from './CartPage'
import CheckoutPage from './CheckoutPage'
import ShopPage from './ShopPage'
import WishlistPage from './WishlistPage'
import AboutPage from './AboutPage'
import JournalPage, { JournalArticlePage } from './JournalPage'
import FaqPage from './FaqPage'
import ContactPage from './ContactPage'
import ProductDetailPage from './ProductDetailPage'
import NotFoundPage from './NotFoundPage'
import OrderPage from './OrderPage'
import AccountPage from './AccountPage'
import BrewingGuidePage from './BrewingGuidePage'
import GardensPage from './GardensPage'
import ConsentBanner from './ConsentBanner'
import { PrivacyPage, TermsPage, ShippingReturnsPage } from './LegalPages'
import Footer from './Footer'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { useHashRoute, parseRoute, Link } from '../lib/router'
import { setLenis } from '../lib/scroll'

gsap.registerPlugin(ScrollTrigger)

const NAV_LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/journal', label: 'Journal' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

const getLoadingMessage = (percent: number) => {
  if (percent < 20) return "Gathering the harvest..."
  if (percent < 40) return "Selecting the finest leaves..."
  if (percent < 65) return "Preparing the sensory flight..."
  if (percent < 85) return "Refining the steeping temperature..."
  return "Enjoying the first sip..."
}

export default function TeaVectorHomepage() {
  const route = useHashRoute()
  const { name: routeName, id: routeId } = parseRoute(route)
  const isHome = routeName === 'home'
  const { cartCount } = useCart()
  const { user, logout } = useAuth()
  const { openLogin } = useUi()

  const [loadingPercentage, setLoadingPercentage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fadeLoader, setFadeLoader] = useState(false)
  // Quantized scrub state: only the two thresholds the header cares about.
  // Storing raw progress here would re-render the whole app shell every frame.
  const [scrub, setScrub] = useState({ past45: false, past95: false })
  const [menuOpen, setMenuOpen] = useState(false)

  // Loader: time-capped with a hard fallback so users are never stuck if the video fails
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setLoading(false)
      return
    }
    let percent = 0
    const interval = window.setInterval(() => {
      percent = percent + (92 - percent) * 0.15
      setLoadingPercentage(Math.round(percent))
    }, 120)
    const timer = window.setTimeout(() => {
      window.clearInterval(interval)
      setLoadingPercentage(100)
      setFadeLoader(true)
      window.setTimeout(() => setLoading(false), 900)
    }, 3200)
    return () => {
      window.clearInterval(interval)
      window.clearTimeout(timer)
    }
  }, [])

  // Initialize Lenis smooth scroll synced to GSAP ticker (skipped for reduced motion)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      syncTouch: true,
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
    setScrub({ past45: false, past95: false })
    setMenuOpen(false)
  }, [route])

  // Close the mobile menu on Escape
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Header chrome derived from scrub progress or non-home routes
  const isNavbar = !isHome || scrub.past95
  const useDarkText = isNavbar || scrub.past45

  const handleProgress = (progress: number) => {
    const past45 = progress > 0.45
    const past95 = progress > 0.95
    // Bail out unless a threshold was actually crossed — this runs every scroll frame.
    setScrub((s) => (s.past45 === past45 && s.past95 === past95 ? s : { past45, past95 }))
  }

  // Brand pinned near the edge on phones, 32px on desktop.
  const brandLeft = 'clamp(16px, 4vw, 32px)'
  const brandStyle = isNavbar
    ? { left: brandLeft, transform: 'translate(0, 0)' }
    : { left: '50%', transform: 'translate(-50%, 10vh)' }

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

      {/* Premium Full-Screen Loading Overlay */}
      {loading && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060b08] transition-opacity duration-1000 ease-in-out ${
            fadeLoader ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="text-center space-y-6">
            <h1 className="text-white text-5xl md:text-6xl font-extrabold tracking-tight uppercase font-sans animate-pulse">
              Elegant Sip
            </h1>
            <p className="text-[#8bb56e] text-sm font-mono tracking-widest uppercase">
              The Journey of Tea
            </p>
            <div className="w-64 h-[1px] bg-white/10 mx-auto relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full bg-[#8bb56e] transition-all duration-300 ease-out"
                style={{ width: `${loadingPercentage}%` }}
              />
            </div>
            <div className="space-y-1">
              <p className="text-white/60 text-xs font-light italic">
                {getLoadingMessage(loadingPercentage)}
              </p>
              <p className="text-white/30 text-[10px] font-mono tracking-wider">
                Loading Experience... {loadingPercentage}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fixed Header & Navigation Bar */}
      {!loading && (
        <>
        <header
          className={`fixed top-0 left-0 right-0 z-40 px-8 py-6 transition-all duration-700 ease-in-out ${
            isNavbar
              ? 'bg-white/70 backdrop-blur-md border-b border-[#1b261b]/10 h-20'
              : 'bg-transparent h-32 pointer-events-none'
          }`}
        >
          {/* Brand Container */}
          <div
            style={isNavbar ? { left: brandLeft, transform: 'translate(0, 0)' } : brandStyle}
            className={`absolute top-6 flex items-center transition-all duration-700 ease-in-out pointer-events-auto cursor-pointer ${
              isNavbar ? 'flex-row gap-3' : 'flex-col gap-3 text-center'
            }`}
          >
            <Link to="/" aria-label="Elegant Sip home">
              <span
                className={`font-sans uppercase transition-all duration-700 ease-in-out font-bold ${
                  isNavbar
                    ? 'text-lg sm:text-xl tracking-tight text-[#1b261b]'
                    : `text-5xl md:text-6xl tracking-tight ${useDarkText ? 'text-black' : 'text-white'}`
                }`}
              >
                Elegant Sip
              </span>
            </Link>
          </div>

          {/* Nav links (active when navbar is active) */}
          <nav
            aria-label="Primary"
            inert={!isNavbar}
            className={`absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden lg:flex items-center gap-8 transition-all duration-700 ease-in-out ${
              isNavbar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {NAV_LINKS.map((link) => {
              const active = routeName === link.to.slice(1)
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-[11px] font-mono tracking-widest uppercase transition-colors ${
                    active
                      ? 'text-[#8bb56e] font-bold'
                      : 'text-[#1b261b] hover:text-[#8bb56e]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* Right Action Container */}
          <div
            inert={!isNavbar}
            className={`absolute right-3 sm:right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-3 md:gap-5 transition-all duration-700 ease-in-out ${
              isNavbar ? 'opacity-100 pointer-events-auto scale-100' : 'opacity-0 pointer-events-none scale-90'
            }`}
          >
            {/* Wishlist (in the mobile menu on phones) */}
            <Link
              to="/wishlist"
              aria-label="Wishlist"
              className={`hidden sm:block transition-colors relative p-2 ${isNavbar ? 'text-[#1b261b] hover:text-[#8bb56e]' : 'text-white hover:text-[#8bb56e]'}`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </Link>

            {/* Cart */}
            <Link
              to="/cart"
              aria-label="Cart"
              className={`transition-colors relative p-2 ${
                routeName === 'cart'
                  ? 'text-[#8bb56e]'
                  : isNavbar
                  ? 'text-[#1b261b] hover:text-[#8bb56e]'
                  : 'text-white hover:text-[#8bb56e]'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-[#8bb56e] text-white text-[9px] font-mono font-bold flex items-center justify-center rounded-full px-1 border border-white">
                  {cartCount}
                </span>
              ) : (
                <span className="absolute top-0 right-0 w-2 h-2 bg-[#8bb56e] rounded-full animate-ping" />
              )}
            </Link>

            {/* Menu toggle (mobile & tablet) */}
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              className={`lg:hidden p-2 transition-colors cursor-pointer ${
                isNavbar ? 'text-[#1b261b] hover:text-[#8bb56e]' : 'text-white hover:text-[#8bb56e]'
              }`}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                )}
              </svg>
            </button>

            {/* Account */}
            {user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  to="/account"
                  className="text-xs font-mono uppercase tracking-wider text-[#4a584a] hover:text-[#8bb56e] transition-colors max-w-[120px] truncate"
                >
                  {user.name.split(' ')[0]}
                </Link>
                <button
                  onClick={logout}
                  className="px-4 py-2 border rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border-[#1b261b]/20 text-[#1b261b] hover:bg-[#8bb56e] hover:text-white hover:border-[#8bb56e]"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                onClick={openLogin}
                className={`px-3.5 py-1.5 sm:px-5 sm:py-2 border rounded-full text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer ${
                  isNavbar
                    ? 'border-[#1b261b]/20 text-[#1b261b] hover:bg-[#8bb56e] hover:text-white hover:border-[#8bb56e]'
                    : 'border-white/20 text-white hover:bg-[#8bb56e] hover:text-black hover:border-[#8bb56e]'
                }`}
              >
                Login
              </button>
            )}
          </div>
        </header>

        {/* Mobile navigation panel */}
        {menuOpen && (
          <div
            id="mobile-menu"
            className="lg:hidden fixed top-20 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#1b261b]/10 shadow-[0_12px_40px_rgba(27,38,27,0.08)]"
          >
            <nav aria-label="Primary mobile" className="px-8 py-6 flex flex-col">
              {NAV_LINKS.map((link) => {
                const active = routeName === link.to.slice(1)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`py-3.5 text-xs font-mono tracking-widest uppercase border-b border-[#1b261b]/5 last:border-0 transition-colors ${
                      active ? 'text-[#8bb56e] font-bold' : 'text-[#1b261b] hover:text-[#8bb56e]'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <Link
                to="/wishlist"
                className={`sm:hidden py-3.5 text-xs font-mono tracking-widest uppercase border-b border-[#1b261b]/5 transition-colors ${
                  routeName === 'wishlist' ? 'text-[#8bb56e] font-bold' : 'text-[#1b261b] hover:text-[#8bb56e]'
                }`}
              >
                Wishlist
              </Link>
              {user && (
                <Link
                  to="/account"
                  className={`py-3.5 text-xs font-mono tracking-widest uppercase border-b border-[#1b261b]/5 transition-colors ${
                    routeName === 'account' ? 'text-[#8bb56e] font-bold' : 'text-[#1b261b] hover:text-[#8bb56e]'
                  }`}
                >
                  My Account
                </Link>
              )}
              {user && (
                <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#1b261b]/10 md:hidden">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#4a584a] max-w-[160px] truncate">
                    {user.name.split(' ')[0]}
                  </span>
                  <button
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                    }}
                    className="px-4 py-2 border rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border-[#1b261b]/20 text-[#1b261b] hover:bg-[#8bb56e] hover:text-white hover:border-[#8bb56e]"
                  >
                    Logout
                  </button>
                </div>
              )}
            </nav>
          </div>
        )}
        </>
      )}

      {/* Main content */}
      <main id="main-content" className="relative z-20">
        {page}
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
