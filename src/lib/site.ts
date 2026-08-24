/* ────────────────────────────────────────────────────────────────────────────
 * Site-wide constants — the single source of truth for the canonical origin,
 * brand strings and default social card. Anything that builds an absolute URL
 * (canonical tags, JSON-LD, the sitemap generator) reads from here so the
 * production domain is never hardcoded in two places.
 * ──────────────────────────────────────────────────────────────────────────── */

/** Production origin, no trailing slash. */
export const SITE_URL = 'https://elegantsip.com'

/** Brand name — always two words. "Elegant Sip" is not a brand spelling. */
export const BRAND = 'Elegant Sip'

/** Title separator. Every document title is `Page | Elegant Sip`. */
export const TITLE_SEP = '|'

export const DEFAULT_TITLE = 'Single-Origin Darjeeling Tea | Elegant Sip'

export const DEFAULT_DESCRIPTION =
  'Buy single-origin Darjeeling first flush tea online in India. Whole leaf, broken leaf and fannings, packed close to harvest and shipped direct from the garden.'

/** 1200×630 social card. */
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.webp`

export const CONTACT_EMAIL = 'elegantsipdarjeeling@gmail.com'
export const WHATSAPP_NUMBER = '+917583995294'
export const WHATSAPP_URL = 'https://wa.me/917583995294'
export const INSTAGRAM_URL = 'https://www.instagram.com/elegantsip_darjeeling'
export const FACEBOOK_URL = 'https://www.facebook.com/profile.php?id=61586479127169'

/** Build a page title. Pass `undefined` for the home page's standalone title. */
export const pageTitle = (page?: string): string =>
  page ? `${page} ${TITLE_SEP} ${BRAND}` : DEFAULT_TITLE

/** Absolute URL for a site-relative path (`/shop` → `https://elegantsip.com/shop`). */
export const absoluteUrl = (path: string): string =>
  `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
