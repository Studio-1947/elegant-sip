import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Catches render-time throws so a single bad component (or a tampered
 * localStorage payload) degrades to a recoverable screen instead of a blank
 * page. "Reset local data" clears the keys that can poison a boot — the cart,
 * wishlist and coupon are all re-derivable, so nothing of value is lost.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept as console.error (not a logger) until the app has a backend to
    // report to — this is the only place an unhandled render error surfaces.
    console.error('Unhandled render error:', error, info.componentStack)
  }

  private handleReset = () => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('elegant_sip_')) localStorage.removeItem(key)
    }
    window.location.href = '/'
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans flex items-center justify-center px-6 py-24">
        <div className="max-w-md w-full text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <span className="text-[#5f8f42] text-xs font-mono tracking-[0.3em] uppercase block mb-4">
            Something spilled
          </span>
          <h1 className="text-2xl md:text-3xl font-bold uppercase tracking-tight mb-3">
            This page didn't brew
          </h1>
          <p className="text-sm text-[#4a584a] leading-relaxed mb-8">
            An unexpected error stopped the page from loading. Reloading usually fixes it. If it
            keeps happening, resetting the data this site has saved in your browser will clear it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex-grow bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              className="flex-grow border border-[#1b261b]/20 hover:border-[#1b261b] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-6 rounded-lg transition-colors cursor-pointer"
            >
              Reset local data
            </button>
          </div>
          <p className="text-[11px] text-[#4a584a] mt-6">
            Resetting clears your cart, wishlist and saved coupon on this device only.
          </p>
        </div>
      </div>
    )
  }
}
