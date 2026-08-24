/* ────────────────────────────────────────────────────────────────────────────
 * SEO route manifest — the single source of truth for per-route metadata.
 *
 * Read twice: by the pages at runtime (`useDocumentMeta`) and by the build
 * (`vite.config.ts`) to emit `sitemap.xml` and one prerendered HTML shell per
 * URL. Because both sides read this file, the sitemap can never drift from the
 * catalogue and a page's <title> can never disagree with its indexed entry.
 * ──────────────────────────────────────────────────────────────────────────── */

import { PRODUCTS } from '../data/products'
import { JOURNAL } from '../data/content'
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageTitle } from './site'

export interface RouteMeta {
  title: string
  description: string
  /** Sitemap priority. Omit to exclude the route from the sitemap entirely. */
  priority?: number
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  /** Transactional/utility routes: rendered with `noindex, follow`. */
  noindex?: boolean
  /** Social card override. */
  image?: string
}

/** Static routes. Product and journal routes are derived below. */
export const ROUTE_META: Record<string, RouteMeta> = {
  '/': {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    priority: 1.0,
    changefreq: 'weekly',
  },
  '/shop': {
    title: pageTitle('Buy Darjeeling Tea Online'),
    description:
      'Shop single-origin Darjeeling first flush tea: whole leaf, broken leaf, broken mixed and fannings. Whole-rupee pricing, free shipping over ₹4,000, packed close to harvest.',
    priority: 0.9,
    changefreq: 'weekly',
    image: '/shopimg.webp',
  },
  '/about': {
    title: pageTitle('Our Story'),
    description:
      'Elegant Sip is a Darjeeling tea brand buying direct from the garden — no auction houses, no middlemen, no blending. The garden is named on every pack.',
    priority: 0.6,
    changefreq: 'monthly',
  },
  '/gardens': {
    title: pageTitle('The Darjeeling Gardens We Buy From'),
    description:
      'The Darjeeling estates behind our first flush: elevation, cultivar, and the harvest windows that shape each cup. Buy direct from the garden that grew the leaf.',
    priority: 0.6,
    changefreq: 'monthly',
  },
  '/brewing': {
    title: pageTitle('How to Brew Darjeeling Tea'),
    description:
      'Water temperature, steep time, leaf amount and re-steep counts for every Darjeeling grade we sell. A practical brewing guide, not a marketing page.',
    priority: 0.7,
    changefreq: 'monthly',
  },
  '/journal': {
    title: pageTitle('The Journal'),
    description:
      'Craft, sourcing and the ritual of brewing — notes from the Darjeeling gardens behind our single-origin teas.',
    priority: 0.7,
    changefreq: 'weekly',
  },
  '/faq': {
    title: pageTitle('Frequently Asked Questions'),
    description:
      'Answers about shipping, the 30-day Elegant Sip Promise, freshness, and how to brew single-origin Darjeeling tea.',
    priority: 0.5,
    changefreq: 'monthly',
  },
  '/contact': {
    title: pageTitle('Contact Us'),
    description: 'Questions about an order, a grade, or wholesale? Reach the Elegant Sip team by email or WhatsApp.',
    priority: 0.4,
    changefreq: 'yearly',
  },
  '/shipping': {
    title: pageTitle('Shipping & Returns'),
    description: 'Shipping timelines and costs, and the 30-day Elegant Sip Promise on every pack.',
    priority: 0.4,
    changefreq: 'yearly',
  },
  '/privacy': {
    title: pageTitle('Privacy Policy'),
    description: 'What Elegant Sip stores, where it is stored, and what we never send to third parties.',
    priority: 0.3,
    changefreq: 'yearly',
  },
  '/terms': {
    title: pageTitle('Terms & Conditions'),
    description: 'The terms that govern use of the Elegant Sip site and any order placed through it.',
    priority: 0.3,
    changefreq: 'yearly',
  },
  /* Transactional routes — reachable, never indexed. */
  '/cart': { title: pageTitle('Your Cart'), description: 'Review the teas in your cart.', noindex: true },
  '/checkout': { title: pageTitle('Checkout'), description: 'Complete your Elegant Sip order.', noindex: true },
  '/wishlist': { title: pageTitle('Wishlist'), description: 'Teas you have saved for later.', noindex: true },
  '/account': { title: pageTitle('My Account'), description: 'Your Elegant Sip orders and saved teas.', noindex: true },
  '/order': { title: pageTitle('Your Order'), description: 'Your Elegant Sip order details.', noindex: true },
}

/** Meta for a product detail route, derived from the catalogue. */
export function productRouteMeta(id: string): RouteMeta | undefined {
  const product = PRODUCTS.find((p) => p.id === id)
  if (!product) return undefined
  return {
    title: pageTitle(`${product.name} — Darjeeling ${product.category}`),
    description: product.description,
    priority: 0.8,
    changefreq: 'monthly',
    image: product.imageSrc,
  }
}

/** Meta for a journal article route. */
export function articleRouteMeta(id: string): RouteMeta | undefined {
  const article = JOURNAL.find((a) => a.id === id)
  if (!article) return undefined
  return {
    title: pageTitle(article.title),
    description: article.excerpt,
    priority: 0.5,
    changefreq: 'yearly',
    image: article.imageSrc,
  }
}

export interface SitemapEntry {
  path: string
  priority: number
  changefreq: string
}

/**
 * Every indexable URL on the site, derived from `ROUTE_META` plus the live
 * catalogue and journal. Consumed by the build to write `sitemap.xml`.
 */
export function indexableRoutes(): SitemapEntry[] {
  const entries: SitemapEntry[] = []
  for (const [path, meta] of Object.entries(ROUTE_META)) {
    if (meta.noindex || meta.priority === undefined) continue
    entries.push({ path, priority: meta.priority, changefreq: meta.changefreq ?? 'monthly' })
  }
  for (const product of PRODUCTS) {
    entries.push({ path: `/product/${product.id}`, priority: 0.8, changefreq: 'monthly' })
  }
  for (const article of JOURNAL) {
    entries.push({ path: `/journal/${article.id}`, priority: 0.5, changefreq: 'yearly' })
  }
  return entries
}
