import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import TeaDiscoveryQuizModal from './TeaDiscoveryQuizModal'
import LoginModal from './LoginModal'
import CartDrawer from './CartDrawer'
import { loadAuthMethods } from '../lib/authMethods'

interface UiContextType {
  isQuizOpen: boolean
  openQuiz: () => void
  closeQuiz: () => void
  isLoginOpen: boolean
  openLogin: () => void
  closeLogin: () => void
  isCartOpen: boolean
  openCart: () => void
  closeCart: () => void
  showToast: (message: string) => void
}

const UiContext = createContext<UiContextType | undefined>(undefined)

export function UiProvider({ children }: { children: ReactNode }) {
  const [isQuizOpen, setIsQuizOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const openQuiz = () => setIsQuizOpen(true)
  const closeQuiz = () => setIsQuizOpen(false)
  const openLogin = () => setIsLoginOpen(true)
  const closeLogin = () => setIsLoginOpen(false)
  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)
  const showToast = (message: string) => {
    window.clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }

  useEffect(() => () => window.clearTimeout(toastTimer.current), [])
  // Learn early whether WhatsApp sign-in is on, so the login box opens on the right form.
  useEffect(() => {
    void loadAuthMethods()
  }, [])

  return (
    <UiContext.Provider
      value={{ isQuizOpen, openQuiz, closeQuiz, isLoginOpen, openLogin, closeLogin, isCartOpen, openCart, closeCart, showToast }}
    >
      {children}
      <TeaDiscoveryQuizModal isOpen={isQuizOpen} onClose={closeQuiz} />
      {/* Mounted only while open: a closed form keeps no email, password or code in memory. */}
      {isLoginOpen && <LoginModal isOpen onClose={closeLogin} />}
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 z-[80] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-[#1b261b] px-5 py-3 text-center text-xs font-medium text-white shadow-[0_12px_30px_rgba(27,38,27,0.24)]">
          {toast}
        </div>
      )}
    </UiContext.Provider>
  )
}

export function useUi() {
  const context = useContext(UiContext)
  if (!context) {
    throw new Error('useUi must be used within a UiProvider')
  }
  return context
}
