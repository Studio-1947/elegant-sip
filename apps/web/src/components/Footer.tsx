import { Link } from '../lib/router'
import { openConsentSettings, trackingConfigured } from '../lib/analytics'
import { useUi } from './UiContext'
import { FSSAI_LICENSE } from '../lib/site'

const SOCIALS = [
            { label: 'Instagram', href: 'https://www.instagram.com/elegantsip_darjeeling', d: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zm0 10.162a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
            { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61586479127169', d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' },
            { label: 'WhatsApp', href: 'https://wa.me/917583995294', d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' },
]

const EMAIL = 'elegantsipdarjeeling@gmail.com'
const WHATSAPP = 'https://wa.me/917583995294'

/** Social icon buttons: light-on-dark on phones, dark-on-light from tablet up, like the rest of the footer. */
function SocialLinks({ className }: { className: string }) {
  return (
    <div className={className}>
      {SOCIALS.map((social) => (
        <a
          key={social.label}
          href={social.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={social.label}
          className="w-11 h-11 rounded-full border border-white/20 text-white/70 md:border-[#1b261b]/15 md:text-[#4a584a] hover:text-white hover:bg-[#8bb56e] hover:border-[#8bb56e] flex items-center justify-center transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={social.d} />
          </svg>
        </a>
      ))}
    </div>
  )
}

export default function Footer() {
  const { openQuiz } = useUi()
  const year = new Date().getFullYear()

  // Phones keep their original stacked footer (every md:/lg: class below is the
  // tablet-and-up layout). From tablet up:
  //   iPad portrait  — brand row across the top (identity left, socials and
  //                    contact right), then three even link columns.
  //   lg and wider   — brand column beside three equal link columns.
  // Socials and contact details move into the brand block there, so they belong
  // to the brand instead of floating on rows of their own.
  const linkClass = 'inline-block py-3 lg:py-2 no-underline hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors'
  const listClass = '-my-3 lg:-my-2 text-xs md:text-[13px] text-white/70 md:text-[#4a584a]'
  const headingClass = 'text-[11px] font-mono tracking-[0.3em] uppercase text-[#a8cf8a] md:text-[#4a7333] mb-5'

  return (
    <footer className="bg-[#1b261b] md:bg-[#f9faf7] border-t border-white/10 md:border-[#1b261b]/10">
      <div className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-14 md:pt-16 md:pb-10 lg:pt-20">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] gap-10 md:gap-x-8 md:gap-y-12 lg:gap-x-10 mb-12 md:mb-14 lg:mb-16">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-1 md:flex md:items-start md:justify-between md:gap-10 lg:flex-col lg:justify-start lg:gap-8 lg:pr-6">
            <div>
              <span
                role="img"
                aria-label="Elegant Sip"
                className="inline-block h-8 md:h-9 bg-white md:bg-[#1b261b] mb-4 md:mb-5"
                style={{
                  width: 'auto',
                  aspectRatio: '5508 / 1921',
                  WebkitMaskImage: 'url(/weblogo.svg)',
                  maskImage: 'url(/weblogo.svg)',
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  WebkitMaskPosition: 'left center',
                  maskPosition: 'left center',
                }}
              />
              <p className="text-xs md:text-sm text-white/60 md:text-[#4a584a] leading-relaxed md:max-w-xs">
                The journey of tea, from mountain mist to golden cup. Single-origin leaves,
                sourced directly from named gardens.
              </p>
            </div>

            {/* Tablet and up: socials and direct contact sit with the brand. */}
            <div className="hidden md:flex md:flex-col md:items-end md:gap-4 lg:items-start md:shrink-0">
              <SocialLinks className="flex items-center gap-3" />
              <div className="text-[13px] text-[#4a584a] md:text-right lg:text-left space-y-1">
                <a href={`mailto:${EMAIL}`} className="block no-underline hover:text-[#4a7333] transition-colors">
                  {EMAIL}
                </a>
                <p>
                  Order questions?{' '}
                  <a href={WHATSAPP} className="underline underline-offset-2 hover:text-[#4a7333] transition-colors">
                    WhatsApp us
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* Shop */}
          <nav aria-label="Shop links">
            <h2 className={headingClass}>Shop</h2>
            <ul className={listClass}>
              <li><Link to="/shop" className={linkClass}>The Collection</Link></li>
              <li><Link to="/wishlist" className={linkClass}>Wishlist</Link></li>
              <li>
                <button onClick={openQuiz} className="py-3 lg:py-2 text-left hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors cursor-pointer">
                  Taste Matcher Quiz
                </button>
              </li>
            </ul>
          </nav>

          {/* Learn */}
          <nav aria-label="Learn links">
            <h2 className={headingClass}>Learn</h2>
            <ul className={listClass}>
              <li><Link to="/about" className={linkClass}>Our Story</Link></li>
              <li><Link to="/gardens" className={linkClass}>The Gardens</Link></li>
              <li><Link to="/journal" className={linkClass}>Journal</Link></li>
              <li><Link to="/brewing" className={linkClass}>Brewing Guide</Link></li>
            </ul>
          </nav>

          {/* Support */}
          <nav aria-label="Support links" className="col-span-2 md:col-span-1">
            <h2 className={headingClass}>Support</h2>
            <ul className={listClass}>
              <li><Link to="/contact" className={linkClass}>Support</Link></li>
              <li><Link to="/faq" className={linkClass}>Frequently Asked Questions</Link></li>
              <li><Link to="/shipping" className={linkClass}>Shipping & Returns</Link></li>
              <li><Link to="/account" className={linkClass}>My Account</Link></li>
              {/* Phones only — from tablet up the address sits in the brand block. */}
              <li className="md:hidden"><a href={`mailto:${EMAIL}`} className={`${linkClass} break-all`}>{EMAIL}</a></li>
            </ul>
          </nav>
        </div>

        {/* Socials — phones only; from tablet up they sit in the brand block. */}
        <SocialLinks className="flex md:hidden items-center justify-start gap-4 mb-10" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-t border-white/10 md:border-[#1b261b]/10 pt-8 pb-14 md:pb-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 md:w-full md:justify-between md:gap-8">
            <p className="text-white/70 md:text-[#4a584a] text-[11px] font-mono tracking-wider md:leading-relaxed">
              © {year} Elegant Sip. All rights reserved. Est. 2024.
              <span className="block sm:inline sm:ml-3 md:block md:ml-0 lg:inline lg:ml-3">FSSAI Lic. No. {FSSAI_LICENSE}</span>
            </p>
            <nav aria-label="Legal links" className="flex items-center gap-4 md:gap-6 md:shrink-0 text-[11px] font-mono tracking-wider text-white/50 md:text-[#4a584a]">
              <Link to="/privacy" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Terms</Link>
              <Link to="/shipping" className="hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Shipping</Link>
              {trackingConfigured() && (
                <button type="button" onClick={openConsentSettings} className="cursor-pointer hover:text-[#a8cf8a] md:hover:text-[#4a7333] transition-colors">Cookie preferences</button>
              )}
            </nav>
          </div>
          {/* Phones only — from tablet up this line sits in the brand block.
              No payment-network badges: Razorpay decides which methods are
              offered at checkout, so logos here could promise one it hides. */}
          <p className="md:hidden text-[11px] font-mono tracking-wider text-white/50">
            Questions about an order? Message us on{' '}
            <a
              href={WHATSAPP}
              className="underline underline-offset-2 hover:text-[#a8cf8a] transition-colors"
            >
              WhatsApp
            </a>
          </p>
        </div>
      </div>
    </footer>
  )
}
