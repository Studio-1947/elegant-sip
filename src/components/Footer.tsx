import { Link } from '../lib/router'
import { useUi } from './UiContext'

export default function Footer() {
  const { openQuiz } = useUi()
  const year = new Date().getFullYear()

  return (
    <footer className="bg-[#f9faf7] border-t border-[#1b261b]/10">
      <div className="max-w-6xl mx-auto px-6 md:px-16 lg:px-24 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-14">
          {/* Brand */}
          <div className="md:col-span-1">
            <span className="text-[#1b261b] text-lg font-bold uppercase tracking-tight block mb-4">
              Elegant <span className="text-[#8bb56e]">Sip</span>
            </span>
            <p className="text-xs text-[#4a584a] leading-relaxed">
              The journey of tea, from mountain mist to golden cup. Single-origin leaves,
              sourced directly from named gardens.
            </p>
          </div>

          {/* Shop */}
          <nav aria-label="Shop links">
            <h3 className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#8bb56e] mb-5">Shop</h3>
            <ul className="space-y-3 text-xs text-[#4a584a]">
              <li><Link to="/shop" className="hover:text-[#8bb56e] transition-colors">The Collection</Link></li>
              <li><Link to="/product/elegant-trio" className="hover:text-[#8bb56e] transition-colors">The Elegant Trio</Link></li>
              <li><Link to="/wishlist" className="hover:text-[#8bb56e] transition-colors">Wishlist</Link></li>
              <li>
                <button onClick={openQuiz} className="hover:text-[#8bb56e] transition-colors cursor-pointer">
                  Taste Matcher Quiz
                </button>
              </li>
            </ul>
          </nav>

          {/* Learn */}
          <nav aria-label="Learn links">
            <h3 className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#8bb56e] mb-5">Learn</h3>
            <ul className="space-y-3 text-xs text-[#4a584a]">
              <li><Link to="/about" className="hover:text-[#8bb56e] transition-colors">Our Story</Link></li>
              <li><Link to="/journal" className="hover:text-[#8bb56e] transition-colors">Journal</Link></li>
              <li><Link to="/journal/field-guide-to-steeping" className="hover:text-[#8bb56e] transition-colors">Brewing Guide</Link></li>
              <li><Link to="/faq" className="hover:text-[#8bb56e] transition-colors">FAQ</Link></li>
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label="Support links">
            <h3 className="text-[10px] font-mono tracking-[0.3em] uppercase text-[#8bb56e] mb-5">Support</h3>
            <ul className="space-y-3 text-xs text-[#4a584a]">
              <li><Link to="/contact" className="hover:text-[#8bb56e] transition-colors">Contact Us</Link></li>
              <li><Link to="/faq" className="hover:text-[#8bb56e] transition-colors">Shipping & Returns</Link></li>
              <li><a href="mailto:hello@elegantsip.com" className="hover:text-[#8bb56e] transition-colors">hello@elegantsip.com</a></li>
              <li><a href="/robots.txt" className="hover:text-[#8bb56e] transition-colors">Robots</a></li>
            </ul>
          </nav>
        </div>

        {/* Socials */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {[
            { label: 'Instagram', d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
            { label: 'Pinterest', d: 'M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z' },
            { label: 'YouTube', d: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' },
            { label: 'TikTok', d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z' },
          ].map((social) => (
            <a
              key={social.label}
              href="#/"
              aria-label={social.label}
              className="w-9 h-9 rounded-full border border-[#1b261b]/15 text-[#4a584a] hover:text-white hover:bg-[#8bb56e] hover:border-[#8bb56e] flex items-center justify-center transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d={social.d} />
              </svg>
            </a>
          ))}
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-[#1b261b]/10 pt-8">
          <p className="text-[#4a584a]/50 text-[11px] font-mono tracking-wider">
            © {year} Elegant Sip. All rights reserved. Est. 2024.
          </p>
          <div className="flex items-center gap-2">
            {['VISA', 'MC', 'AMEX', 'PayPal', 'Apple Pay'].map((m) => (
              <span key={m} className="text-[9px] font-mono uppercase tracking-wider border border-[#1b261b]/10 rounded px-2 py-1 text-[#4a584a]/60 bg-white">
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
