import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TeaVectorHomepage from './components/TeaVectorHomepage'
import ErrorBoundary from './components/ErrorBoundary'
import { CartProvider } from './components/CartContext'
import { AuthProvider } from './components/AuthContext'
import { UiProvider } from './components/UiContext'
import { migrateLegacyHashUrl } from './lib/router'

// Old `/#/shop` links (bookmarks, the pre-history-router sitemap, anything
// already shared) resolve to `/shop` before React mounts.
migrateLegacyHashUrl()

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
