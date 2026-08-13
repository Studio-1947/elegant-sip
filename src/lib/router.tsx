import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react'
import { scrollToTop } from './scroll'

/* ── Hash router (no external dependency; SPA-friendly for any static host) ── */

export function getRoute(): string {
  const raw = window.location.hash.replace(/^#/, '')
  return raw === '' ? '/' : raw
}

export function useHashRoute(): string {
  const [route, setRoute] = useState<string>(getRoute)
  useEffect(() => {
    const onChange = () => {
      setRoute(getRoute())
      // Reset scroll when the route changes (respects Lenis when active)
      scrollToTop(true)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function navigate(to: string) {
  if (getRoute() === to) return
  window.location.hash = to
}

export interface RouteParts {
  name: string
  id?: string
}

export function parseRoute(route: string): RouteParts {
  const clean = route.startsWith('/') ? route.slice(1) : route
  const [name, id] = clean.split('/')
  return { name: name || 'home', id }
}

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  to: string
  children: ReactNode
}

export function Link({ to, children, ...rest }: LinkProps) {
  return (
    <a href={`#${to}`} {...rest}>
      {children}
    </a>
  )
}

/* ── Per-route document meta (title + description + OG) ───────────────────── */

export function useDocumentMeta(title?: string, description?: string) {
  useEffect(() => {
    if (title) document.title = title
    if (description) {
      let meta = document.querySelector('meta[name="description"]')
      if (!meta) {
        meta = document.createElement('meta')
        meta.setAttribute('name', 'description')
        document.head.appendChild(meta)
      }
      meta.setAttribute('content', description)
      const og = document.querySelector('meta[property="og:description"]')
      if (og) og.setAttribute('content', description)
    }
    if (title) {
      const og = document.querySelector('meta[property="og:title"]')
      if (og) og.setAttribute('content', title)
    }
  }, [title, description])
}

/* ── JSON-LD structured data injection (e.g. Product schema) ──────────────── */

export function useJsonLd(data: object | null) {
  useEffect(() => {
    if (!data) return
    const id = 'route-jsonld'
    let script = document.getElementById(id) as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = id
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(data)
    return () => {
      script?.remove()
    }
  }, [data])
}
