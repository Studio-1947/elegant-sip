import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TeaVectorHomepage from './components/TeaVectorHomepage'
import ErrorBoundary from './components/ErrorBoundary'
import { CartProvider } from './components/CartContext'
import { AuthProvider } from './components/AuthContext'
import { UiProvider } from './components/UiContext'
import { migrateLegacyHashUrl } from './lib/router'
import { initAnalytics } from './lib/analytics'
import { stashUrlToken } from './lib/urlSecrets'

// Old `/#/shop` links (bookmarks, the pre-history-router sitemap, anything
// already shared) resolve to `/shop` before React mounts.
migrateLegacyHashUrl()
// Reset and confirmation tokens leave the address bar before any tag can read it.
stashUrlToken()
// Google Tag Manager and the Meta Pixel load only for visitors who have accepted.
initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <CartProvider>
          <UiProvider>
            <TeaVectorHomepage />
          </UiProvider>
        </CartProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
