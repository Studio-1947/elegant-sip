import { Link } from '../lib/router'
import { useUi } from './UiContext'

export default function Footer() {
  const { openQuiz } = useUi()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#1b261b] md:bg-[#f9faf7] border-t border-white/10 md:border-[#1b261b]/10 rounded-t-3xl md:rounded-none">
      <div className="max-w-6xl mx-auto px-6 md:px-16 lg:px-24 py-14 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-12 mb-12 md:mb-14">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-white md:text-[#1b261b] text-lg font-bold uppercase tracking-tight block mb-4">
              Elegant <span className="text-[#a8cf8a] md:text-[#4a7333]">Sip</span>
            </span>
            <p className="text-xs text-white/60 md:text-[#4a584a] leading-relaxed">
              The journey of tea, from mountain mist to golden cup. Single-origin leaves,
              sourced directly from named gardens.
            </p>
          </div>

          {/* Shop */}
          <nav aria-label="Shop links">
            <h2 className="text-[11px] font-mono tracking-[0.3em] uppercase text-[#a8cf8a] md:text-[#4a7333] mb-5">Shop</h2>
            <ul className="space-y-3 text-xs text-white/70 md:text-[#4a584a]">
              <li><Link to="/shop" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">The Collection</Link></li>
              <li><Link to="/wishlist" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Wishlist</Link></li>
              <li>
                <button onClick={openQuiz} className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors cursor-pointer">
                  Taste Matcher Quiz
                </button>
              </li>
            </ul>
          </nav>

          {/* Learn */}
          <nav aria-label="Learn links">
            <h2 className="text-[11px] font-mono tracking-[0.3em] uppercase text-[#a8cf8a] md:text-[#4a7333] mb-5">Learn</h2>
            <ul className="space-y-3 text-xs text-white/70 md:text-[#4a584a]">
              <li><Link to="/about" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Our Story</Link></li>
              <li><Link to="/gardens" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">The Gardens</Link></li>
              <li><Link to="/journal" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Journal</Link></li>
              <li><Link to="/brewing" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Brewing Guide</Link></li>
              <li><Link to="/faq" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">FAQ</Link></li>
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label="Support links" className="col-span-2 md:col-span-1">
            <h2 className="text-[11px] font-mono tracking-[0.3em] uppercase text-[#a8cf8a] md:text-[#4a7333] mb-5">Support</h2>
            <ul className="space-y-3 text-xs text-white/70 md:text-[#4a584a]">
              <li><Link to="/contact" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Contact Us</Link></li>
              <li><Link to="/shipping" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Shipping & Returns</Link></li>
              <li><Link to="/account" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">My Account</Link></li>
              <li><a href="mailto:elegantsipdarjeeling@gmail.com" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">elegantsipdarjeeling@gmail.com</a></li>
            </ul>
          </nav>
        </div>

        {/* Socials */}
        <div className="flex items-center justify-start md:justify-center gap-4 mb-10">
          {[
            { label: 'Instagram', href: 'https://www.instagram.com/elegantsip_darjeeling', d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
            { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61586479127169', d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
            { label: 'WhatsApp', href: 'https://wa.me/917583995294', d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' },
          ].map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={social.label}
              className="w-9 h-9 rounded-full border border-white/20 text-white/70 md:border-[#1b261b]/15 md:text-[#4a584a] hover:text-white hover:bg-[#8bb56e] hover:border-[#8bb56e] flex items-center justify-center transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d={social.d} />
              </svg>
            </a>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-t border-white/10 md:border-[#1b261b]/10 pt-8 pb-14 md:pb-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6">
            <p className="text-white/70 md:text-[#4a584a] text-[11px] font-mono tracking-wider">
              © {year} Elegant Sip. All rights reserved. Est. 2024.
            </p>
            <nav aria-label="Legal links" className="flex items-center gap-4 text-[11px] font-mono tracking-wider text-white/50 md:text-[#4a584a]">
              <Link to="/privacy" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Terms</Link>
              <Link to="/shipping" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Shipping</Link>
            </nav>
          </div>
          {/* No payment-network badges: checkout is a demo and processes no
              card, so displaying VISA/PayPal marks would claim a capability
              the site does not have. */}
          <p className="text-[11px] font-mono tracking-wider text-white/50 md:text-[#4a584a]">
            To place a real order, message us on{' '}
            <a
              href="https://wa.me/917583995294"
              className="underline underline-offset-2 hover:text-[#a8cf8a] md:hover:text-[#5f8f42] transition-colors"
            >
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
