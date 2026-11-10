import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiClientError, api, type LoginResult, type SessionUser } from '../lib/api'

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
  /** WhatsApp-only accounts carry stand-in email/name values that must not reach an order. */
  emailIsPlaceholder: boolean
  nameIsPlaceholder: boolean
  /** Verified WhatsApp number. */
  phone: string | null
}

interface AuthContextType {
  user: User | null
  /** True until the first /auth/me has resolved — avoids flashing signed-out UI. */
  loading: boolean
  /** With two-step sign-in on, resolves to the code challenge and no one is signed in yet. */
  login: (email: string, password: string) => Promise<LoginResult>
  loginWithWhatsApp: (challengeId: string, code: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Ends every session for this account; throws if the server refused. */
  logoutEverywhere: () => Promise<void>
  refresh: () => Promise<void>
  /** Adopts the user an account-settings call returned. */
  applyUser: (session: SessionUser) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const toUser = (u: SessionUser): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  emailVerified: u.emailVerified,
  // Older API responses lack the flags; the reserved .invalid domain still identifies a stand-in.
  emailIsPlaceholder: u.emailIsPlaceholder ?? u.email.toLowerCase().endsWith('.invalid'),
  nameIsPlaceholder: u.nameIsPlaceholder ?? false,
  phone: u.phone ?? null,
})

/** Who the server says is signed in; never rejects. */
async function fetchSessionUser(): Promise<User | null> {
  try {
    const { user: session } = await api.auth.me()
    return session ? toUser(session) : null
  } catch {
    // A network failure means "unknown", not "signed out" — but there is
    // nothing to show either way, so treat it as anonymous.
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setUser(await fetchSessionUser())
    setLoading(false)
  }, [])

  // State is set only once /auth/me answers.
  useEffect(() => {
    void fetchSessionUser().then((session) => {
      setUser(session)
      setLoading(false)
    })
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login({ email, password })
    if (!result.mfaRequired) setUser(toUser(result.user))
    return result
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

  const logoutEverywhere = useCallback(async () => {
    try {
      await api.auth.logoutAll()
    } catch (error) {
      // Already signed out is the outcome asked for; anything else is reported.
      if (!(error instanceof ApiClientError && error.isUnauthenticated)) throw error
    }
    setUser(null)
  }, [])

  const applyUser = useCallback((session: SessionUser) => setUser(toUser(session)), [])

  const value = useMemo(
    () => ({ user, loading, login, loginWithWhatsApp, register, logout, logoutEverywhere, refresh, applyUser }),
    [user, loading, login, loginWithWhatsApp, register, logout, logoutEverywhere, refresh, applyUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
