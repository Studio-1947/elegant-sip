import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { useCart } from './CartContext'
import { getOrders } from '../lib/orders'
import { formatINR } from '../lib/currency'
import { Link, useDocumentMeta } from '../lib/router'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { openLogin } = useUi()
  const { wishlist } = useCart()
  const orders = getOrders()

  useDocumentMeta('My Account — Elegant Sip', 'Your Elegant Sip orders and saved teas.')

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
        <div className="max-w-md mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-4">My Account</span>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">Welcome back</h1>
          <p className="text-sm text-[#4a584a] leading-relaxed mb-8">
            Sign in to see your order history, wishlist, and saved checkout details.
          </p>
          <button
            onClick={openLogin}
            className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
          <div>
            <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-2">My Account</span>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight">Hello, {user.name.split(' ')[0]}</h1>
            <p className="text-xs font-mono text-[#4a584a] mt-3">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="self-start md:self-auto px-5 py-2.5 border rounded-full text-xs font-mono tracking-wider uppercase transition-all duration-300 cursor-pointer border-[#1b261b]/20 text-[#1b261b] hover:bg-[#8bb56e] hover:text-white hover:border-[#8bb56e]"
          >
            Logout
          </button>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          <Link to="/wishlist" className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 hover:border-[#8bb56e] transition-colors group">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-1 group-hover:text-[#8bb56e] transition-colors">Wishlist</h2>
            <p className="text-xs text-[#4a584a]">{wishlist.length} {wishlist.length === 1 ? 'tea' : 'teas'} saved for later</p>
          </Link>
          <Link to="/shop" className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 hover:border-[#8bb56e] transition-colors group">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-1 group-hover:text-[#8bb56e] transition-colors">The Collection</h2>
            <p className="text-xs text-[#4a584a]">Browse teas from named gardens</p>
          </Link>
        </div>

        {/* Order history */}
        <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Order History</h2>
        {orders.length === 0 ? (
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-8 text-center">
            <p className="text-sm text-[#4a584a] mb-6">No orders on this device yet. Your first cup awaits.</p>
            <Link to="/shop" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
              Explore the Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.number}
                to={`/order/${order.number}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#1b261b]/10 rounded-2xl p-6 hover:border-[#8bb56e] transition-colors group"
              >
                <div>
                  <p className="text-sm font-bold font-mono group-hover:text-[#8bb56e] transition-colors">{order.number}</p>
                  <p className="text-[11px] text-[#4a584a] mt-1">
                    {new Date(order.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {' · '}
                    {order.items.reduce((acc, i) => acc + i.quantity, 0)} items
                  </p>
                </div>
                <span className="text-sm font-bold font-mono">{formatINR(order.total)}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-[10px] font-mono text-[#4a584a]/60 mt-6">
          Demo store — orders are stored in this browser only.
        </p>
      </div>
    </div>
  )
}
