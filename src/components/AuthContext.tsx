import { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react'

export interface User {
  name: string
  email: string
}

interface AuthContextType {
  user: User | null
  login: (name: string, email: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    safeParse<User | null>(localStorage.getItem('elegant_sip_user'), null),
  )

  // Skip the mount write: persisting — for every signed-out visitor left
  // a literal "null" in localStorage on first paint.
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    if (user) localStorage.setItem('elegant_sip_user', JSON.stringify(user))
    else localStorage.removeItem('elegant_sip_user')
  }, [user])

  const login = (name: string, email: string) => setUser({ name, email })
  const logout = () => setUser(null)

  const value = useMemo(() => ({ user, login, logout }), [user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
