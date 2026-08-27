import { useEffect, useMemo, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { scrollToTop } from './scroll'
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, DEFAULT_TITLE, SITE_URL, absoluteUrl } from './site'

/* ────────────────────────────────────────────────────────────────────────────
 * History router.
 *
 * Real paths (`/shop`, `/product/first-flush-whole-leaf`) so every route is a
 * distinct, indexable URL. Requires an SPA fallback rewrite on the host —
 * `public/.htaccess` (Apache/XAMPP), `public/_redirects` (Netlify) and
 * `vercel.json` ship with the repo.
 *
 * Legacy `/#/shop` links are migrated to `/shop` on boot so old inbound links,
 * bookmarks and the previous sitemap keep working.
 * ──────────────────────────────────────────────────────────────────────────── */

/** One-time migration of a legacy hash URL to its history-routed equivalent. */
export function migrateLegacyHashUrl() {
  const { hash, pathname } = window.location
  if (hash.startsWith('#/') && pathname === '/') {
    window.history.replaceState(null, '', hash.slice(1))
  }
}

export function getRoute(): string {
  return `${window.location.pathname}${window.location.search}`
}

/** Notifies every mounted router hook that a `pushState` navigation happened. */
const ROUTE_EVENT = 'elegantsip:route'

export function useRoute(): string {
  const [route, setRoute] = useState<string>(getRoute)
  useEffect(() => {
    const onChange = () => setRoute(getRoute())
    window.addEventListener('popstate', onChange)
    window.addEventListener(ROUTE_EVENT, onChange)
    return () => {
      window.removeEventListener('popstate', onChange)
      window.removeEventListener(ROUTE_EVENT, onChange)
    }
  }, [])
  return route
}

/** Back-compat alias — the router is no longer hash-based. */
export const useHashRoute = useRoute

export function navigate(to: string, options: { replace?: boolean } = {}) {
  if (getRoute() === to) return
  if (options.replace) window.history.replaceState(null, '', to)
  else window.history.pushState(null, '', to)
  window.dispatchEvent(new Event(ROUTE_EVENT))
  // Reset scroll on navigation (respects Lenis when active)
  scrollToTop(true)
}

export interface RouteParts {
  name: string
  id?: string
  query: URLSearchParams
}

export function parseRoute(route: string): RouteParts {
  const [path, queryString = ''] = route.split('?')
  const clean = path.startsWith('/') ? path.slice(1) : path
  const [name, id] = clean.split('/')
  return { name: name || 'home', id, query: new URLSearchParams(queryString) }
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: ReactNode
}

/**
 * Renders a real `<a href="/shop">` so crawlers, middle-click, and "open in new
 * tab" all behave — then intercepts the plain left-click for client routing.
 */
export function Link({ to, children, onClick, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    // Let the browser handle modified clicks and anything already prevented.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(to)
  }
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  )
}

/* ── Document meta ─────────────────────────────────────────────────────────── */

function setMeta(selector: string, attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export interface DocumentMetaOptions {
  /** Absolute or site-relative social image. Defaults to the site OG card. */
  image?: string
  /** Canonical path, e.g. `/shop`. Defaults to the current pathname. */
  canonical?: string
  /** Transactional/utility pages: keep them out of the index but follow links. */
  noindex?: boolean
}

/**
 * Sets title, description, canonical and the full OG/Twitter block for a route,
 * restoring the site defaults on unmount so a route without meta can never
 * inherit the previous page's title.
 */
export function useDocumentMeta(title?: string, description?: string, options: DocumentMetaOptions = {}) {
  const { image, canonical, noindex } = options
  useEffect(() => {
    const resolvedTitle = title || DEFAULT_TITLE
    const resolvedDescription = description || DEFAULT_DESCRIPTION
    const resolvedImage = image
      ? image.startsWith('http')
        ? image
        : absoluteUrl(image)
      : DEFAULT_OG_IMAGE
    const resolvedCanonical = absoluteUrl(canonical ?? window.location.pathname)

    document.title = resolvedTitle
    setMeta('meta[name="description"]', 'name', 'description', resolvedDescription)
    setMeta('meta[property="og:title"]', 'property', 'og:title', resolvedTitle)
    setMeta('meta[property="og:description"]', 'property', 'og:description', resolvedDescription)
    setMeta('meta[property="og:url"]', 'property', 'og:url', resolvedCanonical)
    setMeta('meta[property="og:image"]', 'property', 'og:image', resolvedImage)
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', resolvedTitle)
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', resolvedDescription)
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', resolvedImage)
    setLink('canonical', resolvedCanonical)
    setMeta('meta[name="robots"]', 'name', 'robots', noindex ? 'noindex, follow' : 'index, follow')

    return () => {
      // Restore site defaults so the next route never shows a stale title.
      document.title = DEFAULT_TITLE
      setMeta('meta[name="description"]', 'name', 'description', DEFAULT_DESCRIPTION)
      setMeta('meta[property="og:title"]', 'property', 'og:title', DEFAULT_TITLE)
      setMeta('meta[property="og:description"]', 'property', 'og:description', DEFAULT_DESCRIPTION)
      setMeta('meta[property="og:url"]', 'property', 'og:url', `${SITE_URL}/`)
      setMeta('meta[property="og:image"]', 'property', 'og:image', DEFAULT_OG_IMAGE)
      setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', DEFAULT_TITLE)
      setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', DEFAULT_DESCRIPTION)
      setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', DEFAULT_OG_IMAGE)
      setMeta('meta[name="robots"]', 'name', 'robots', 'index, follow')
    }
  }, [title, description, image, canonical, noindex])
}

/* ── JSON-LD structured data ──────────────────────────────────────────────── */

/**
 * Injects a route-scoped JSON-LD block. The payload is compared by value, so
 * passing an inline object literal no longer tears the script down on every
 * render. `id` lets a page emit several independent blocks (e.g. Product +
 * BreadcrumbList) without them overwriting each other.
 */
export function useJsonLd(data: object | null, id = 'route-jsonld') {
  const serialized = useMemo(() => (data ? JSON.stringify(data) : null), [data])
  useEffect(() => {
    if (!serialized) return
    let script = document.getElementById(id) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = serialized
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [serialized, id])
}
