import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiClientError, api, type SessionUser } from '../lib/api'

/* ────────────────────────────────────────────────────────────────────────────
 * Authentication.
 *
 * Real accounts now: the server holds the session in an httpOnly cookie that
 * JavaScript cannot read, so there is no token in localStorage to steal and
 * nothing here to keep in sync. This context only mirrors who the server says
 * you are.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface User {
  id: string
  name: string
  email: string
  role: 'customer' | 'admin'
  emailVerified: boolean
}

interface AuthContextType {
  user: User | null
  /** True until the first /auth/me has resolved — avoids flashing signed-out UI. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithWhatsApp: (challengeId: string, code: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const toUser = (u: SessionUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const { user: session } = await api.auth.me()
      setUser(session ? toUser(session) : null)
    } catch {
      // A network failure means "unknown", not "signed out" — but there is
      // nothing to show either way, so treat it as anonymous.
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const login = useCallback(async (email: string, password: string) => {
    const { user: session } = await api.auth.login({ email, password })
    setUser(toUser(session))
  }, [])

  const loginWithWhatsApp = useCallback(async (challengeId: string, code: string) => {
    const { user: session } = await api.auth.verifyWhatsApp(challengeId, code)
    setUser(toUser(session))
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    await api.auth.register({ name, email, password })
    /* Registration deliberately does not sign you in: the address is not
       confirmed yet, and the endpoint responds identically whether or not the
       account already existed. Signing in here would leak that difference. */
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.auth.logout()
    } catch (error) {
      // A failed logout call still clears local state; the cookie expires.
      if (!(error instanceof ApiClientError)) throw error
    }
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, loginWithWhatsApp, register, logout, refresh }),
    [user, loading, login, loginWithWhatsApp, register, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
