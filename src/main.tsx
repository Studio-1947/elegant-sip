import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import TeaVectorHomepage from './components/TeaVectorHomepage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TeaVectorHomepage />
  </StrictMode>,
)
