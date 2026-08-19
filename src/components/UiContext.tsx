import { createContext, useContext, useState, ReactNode } from 'react'
import TeaDiscoveryQuizModal from './TeaDiscoveryQuizModal'
import LoginModal from './LoginModal'
import CartDrawer from './CartDrawer'

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
}

const UiContext = createContext<UiContextType | undefined>(undefined)

export function UiProvider({ children }: { children: ReactNode }) {
  const [isQuizOpen, setIsQuizOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)

  const openQuiz = () => setIsQuizOpen(true)
  const closeQuiz = () => setIsQuizOpen(false)
  const openLogin = () => setIsLoginOpen(true)
  const closeLogin = () => setIsLoginOpen(false)
  const openCart = () => setIsCartOpen(true)
  const closeCart = () => setIsCartOpen(false)

  return (
    <UiContext.Provider
      value={{ isQuizOpen, openQuiz, closeQuiz, isLoginOpen, openLogin, closeLogin, isCartOpen, openCart, closeCart }}
    >
      {children}
      <TeaDiscoveryQuizModal isOpen={isQuizOpen} onClose={closeQuiz} />
      <LoginModal isOpen={isLoginOpen} onClose={closeLogin} />
      <CartDrawer isOpen={isCartOpen} onClose={closeCart} />
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
