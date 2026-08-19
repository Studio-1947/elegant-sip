import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { useIsMobile } from '../lib/useMediaQuery'

const NAV_LINKS = [
  { to: '/shop', label: 'Shop' },
  { to: '/journal', label: 'Journal' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

interface SiteHeaderProps {
  /** Whether the compact white navbar state is engaged (vs. the transparent hero state). */
  isNavbar: boolean
  routeName: string
  /** Current route string — the mobile menu closes whenever it changes. */
  route: string
}

/** Fixed site header: brand, desktop nav, cart/wishlist/account actions, mobile menu. */
export default function SiteHeader({ isNavbar, routeName, route }: SiteHeaderProps) {
  const { cartCount } = useCart()
  const { user, logout } = useAuth()
  const { openLogin } = useUi()
  const isMobile = useIsMobile()
  const [menuOpen, setMenuOpen] = useState(false)

  // Close the mobile menu whenever the route changes
  useEffect(() => {
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

  // Brand: centered on phones (mockup layout), pinned left on desktop.
  const brandLeft = 'clamp(16px, 4vw, 32px)'
  const brandStyle = isNavbar
    ? isMobile
      ? { left: '50%', transform: 'translate(-50%, 0)' }
      : { left: brandLeft, transform: 'translate(0, 0)' }
    : { left: '50%', transform: 'translate(-50%, 10vh)' }

  return (
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
          style={brandStyle}
          className={`absolute top-6 flex items-center transition-all duration-700 ease-in-out pointer-events-auto cursor-pointer ${
            isNavbar ? 'flex-row gap-3' : 'flex-col gap-3 text-center'
          }`}
        >
          <Link to="/" aria-label="Elegant Sip home">
            <span
              className={`font-sans uppercase transition-all duration-700 ease-in-out font-bold ${
                isNavbar
                  ? 'text-lg sm:text-xl tracking-tight text-[#1b261b]'
                  : 'text-5xl md:text-6xl tracking-tight text-white'
              }`}
            >
              Elegant Sip
            </span>
          </Link>
        </div>

        {/* Menu toggle — left side on phones (mockup layout) */}
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
          className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 p-2 text-[#1b261b] hover:text-[#8bb56e] transition-colors cursor-pointer pointer-events-auto"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>

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
            className={`hidden md:block transition-colors relative p-2 ${isNavbar ? 'text-[#1b261b] hover:text-[#8bb56e]' : 'text-white hover:text-[#8bb56e]'}`}
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

          {/* Menu toggle (tablet — phones use the left-side toggle) */}
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className={`hidden md:block lg:hidden p-2 transition-colors cursor-pointer ${
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
              className={`hidden md:block px-3.5 py-1.5 sm:px-5 sm:py-2 border rounded-full text-[11px] sm:text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer ${
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
              className={`md:hidden py-3.5 text-xs font-mono tracking-widest uppercase border-b border-[#1b261b]/5 transition-colors ${
                routeName === 'wishlist' ? 'text-[#8bb56e] font-bold' : 'text-[#1b261b] hover:text-[#8bb56e]'
              }`}
            >
              Wishlist
            </Link>
            {!user && (
              <button
                onClick={() => {
                  setMenuOpen(false)
                  openLogin()
                }}
                className="md:hidden py-3.5 text-left text-xs font-mono tracking-widest uppercase text-[#1b261b] hover:text-[#8bb56e] transition-colors cursor-pointer"
              >
                Login
              </button>
            )}
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
  )
}
