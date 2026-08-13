import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TeaVectorHomepage from './components/TeaVectorHomepage'
import { CartProvider } from './components/CartContext'
import { AuthProvider } from './components/AuthContext'
import { UiProvider } from './components/UiContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <AuthProvider>
        <UiProvider>
          <TeaVectorHomepage />
        </UiProvider>
      </AuthProvider>
    </CartProvider>
  </StrictMode>,
)
