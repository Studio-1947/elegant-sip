import type Lenis from 'lenis'

let lenisInstance: Lenis | null = null

export function setLenis(lenis: Lenis | null) {
  lenisInstance = lenis
}

export function getLenis(): Lenis | null {
  return lenisInstance
}

export function scrollToTop(immediate = true) {
  if (lenisInstance) {
    lenisInstance.scrollTo(0, { immediate })
  } else {
    window.scrollTo(0, 0)
  }
}

export function scrollToY(y: number, immediate = false) {
  if (lenisInstance) {
    lenisInstance.scrollTo(y, { immediate })
  } else {
    window.scrollTo({ top: y })
  }
}
