import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TeaVectorHomepage from './components/TeaVectorHomepage'
import { CartProvider } from './components/CartContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CartProvider>
      <TeaVectorHomepage />
    </CartProvider>
  </StrictMode>,
)
