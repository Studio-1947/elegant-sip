import { useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { track } from '../lib/analytics'

interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const { login } = useAuth()

  // ESC to close + initial focus
  useEffect(() => {
    if (!isOpen) return
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@') || email.length < 3) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Please tell us your name.')
      return
    }
    setError(null)
    login(mode === 'signup' ? name.trim() : email.split('@')[0].replace(/[._-]/g, ' '), email.trim())
    track(mode === 'signup' ? 'signup' : 'login', { email: email.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#060b08]/85 backdrop-blur-sm cursor-pointer" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'signin' ? 'Sign in' : 'Create account'}
        className="relative bg-[#f9faf7] text-[#1b261b] rounded-3xl border border-[#1b261b]/10 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-10 z-10"
      >
        <button
          ref={closeRef}
          onClick={onClose}
          className="absolute top-6 right-6 text-[#1b261b]/50 hover:text-[#1b261b] transition-colors cursor-pointer text-xl font-bold z-20"
          aria-label="Close"
        >
          ✕
        </button>

        <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">
          {mode === 'signin' ? 'Welcome Back' : 'Join the Circle'}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
          {mode === 'signin' ? 'Sign in to Elegant Sip' : 'Create your account'}
        </h2>
        <p className="text-xs text-[#4a584a] leading-relaxed mb-8">
          {mode === 'signin'
            ? 'Access your order history, wishlist, and saved addresses.'
            : 'Save your wishlist, track orders, and get early access to limited harvests.'}
        </p>

        {/* Tabs */}
        <div className="flex border border-[#1b261b]/15 rounded-xl p-1 mb-8">
          {(['signin', 'signup'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
              }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-mono tracking-widest uppercase transition-all cursor-pointer ${
                mode === m
                  ? 'bg-[#1b261b] text-white'
                  : 'text-[#4a584a] hover:text-[#1b261b]'
              }`}
            >
              {m === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
                Full Name
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Avery Chen"
                className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
              />
            </div>
          )}
          <div>
            <label htmlFor="auth-email" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25"
            />
          </div>

          {error && <p className="text-xs text-red-600" role="alert">{error}</p>}

          <button
            type="submit"
            className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors active:scale-[0.98] cursor-pointer"
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-[10px] text-[#4a584a]/60 mt-6 leading-relaxed">
          This is a demo experience — no real account is created. Account features will connect
          to the backend when it ships.
        </p>
      </div>
    </div>
  )
}
