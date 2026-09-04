import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { useCart } from './CartContext'
import { useEffect, useState } from 'react'
import { api, type OrderView } from '../lib/api'
import { ApiClientError } from '../lib/api'
import { formatINR } from '../lib/currency'
import { Link, navigate, useDocumentMeta } from '../lib/router'

export default function AccountPage() {
  const { user, logout } = useAuth()
  const { openLogin } = useUi()
  const { wishlist, addToCart } = useCart()
  const [orders, setOrders] = useState<OrderView[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [phone, setPhone] = useState('')
  const [phoneChallenge, setPhoneChallenge] = useState<string | null>(null)
  const [phoneCode, setPhoneCode] = useState('')
  const [phoneMessage, setPhoneMessage] = useState<string | null>(null)
  const [phoneBusy, setPhoneBusy] = useState(false)

  useEffect(() => {
    if (!user) {
      setLoadingOrders(false)
      return
    }
    let cancelled = false
    void api.orders
      .list()
      .then((r) => !cancelled && setOrders(r.orders))
      .catch(() => {})
      .finally(() => !cancelled && setLoadingOrders(false))
    return () => {
      cancelled = true
    }
  }, [user])

  useDocumentMeta('My Account | Elegant Sip', 'Your Elegant Sip orders and saved teas.', { noindex: true })

  const repeatOrder = (order: OrderView) => {
    for (const item of order.items) {
      addToCart({ productSlug: item.productSlug, size: item.variantSize, name: item.productName, price: item.unitPrice, imageSrc: item.imageSrc }, item.quantity)
    }
    navigate('/cart')
  }

  const requestWhatsAppLink = async () => {
    setPhoneMessage(null); setPhoneBusy(true)
    try { const result = await api.account.requestWhatsApp(phone); setPhoneChallenge(result.challengeId); setPhoneMessage('A code has been sent to WhatsApp.') }
    catch (err) { setPhoneMessage(err instanceof ApiClientError ? err.message : 'Could not send a code.') } finally { setPhoneBusy(false) }
  }
  const verifyWhatsAppLink = async () => {
    if (!phoneChallenge) return
    setPhoneMessage(null); setPhoneBusy(true)
    try { await api.account.verifyWhatsApp(phoneChallenge, phoneCode); setPhoneMessage('WhatsApp is linked. You can now sign in with a code.'); setPhoneChallenge(null); setPhoneCode('') }
    catch (err) { setPhoneMessage(err instanceof ApiClientError ? err.message : 'Could not verify that code.') } finally { setPhoneBusy(false) }
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
        <div className="max-w-md mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-4">My Account</span>
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
            <span className="text-[#4a7333] text-xs font-mono tracking-[0.3em] uppercase block mb-2">My Account</span>
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
            <h2 className="text-sm font-bold uppercase tracking-wide mb-1 group-hover:text-[#4a7333] transition-colors">Wishlist</h2>
            <p className="text-xs text-[#4a584a]">{wishlist.length} {wishlist.length === 1 ? 'tea' : 'teas'} saved for later</p>
          </Link>
          <Link to="/shop" className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 hover:border-[#8bb56e] transition-colors group">
            <h2 className="text-sm font-bold uppercase tracking-wide mb-1 group-hover:text-[#4a7333] transition-colors">The Collection</h2>
            <p className="text-xs text-[#4a584a]">Browse teas from named gardens</p>
          </Link>
        </div>

        <section className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 mb-12">
          <h2 className="text-sm font-bold uppercase tracking-wide mb-1">WhatsApp sign-in</h2>
          <p className="text-xs text-[#4a584a] mb-4">Link your number once, then use a WhatsApp OTP instead of your password.</p>
          {!phoneChallenge ? <div className="flex flex-col sm:flex-row gap-3"><input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" inputMode="numeric" className="flex-1 border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm" /><button onClick={() => void requestWhatsAppLink()} disabled={phoneBusy} className="bg-[#1b261b] text-white text-xs font-bold uppercase tracking-widest rounded-lg px-5 py-3">{phoneBusy ? 'Sending…' : 'Link WhatsApp'}</button></div> : <div className="flex flex-col sm:flex-row gap-3"><input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" className="flex-1 border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm tracking-[0.25em]" /><button onClick={() => void verifyWhatsAppLink()} disabled={phoneBusy || phoneCode.length !== 6} className="bg-[#1b261b] text-white text-xs font-bold uppercase tracking-widest rounded-lg px-5 py-3">Verify number</button></div>}
          {phoneMessage && <p role="status" className="text-xs text-[#4a584a] mt-3">{phoneMessage}</p>}
        </section>

        {/* Order history */}
        <h2 className="text-lg font-bold uppercase tracking-wide mb-2">Order History</h2>
                <p className="text-xs text-[#4a584a] mb-6 max-w-2xl leading-relaxed">
          Every order placed with this account, on any device.
        </p>
        {loadingOrders ? (
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-8 text-center text-sm text-[#4a584a]">Loading your orders…</div>
        ) : orders.length === 0 ? (
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-8 text-center">
            <p className="text-sm text-[#4a584a] mb-6">No orders yet. Your first cup awaits.</p>
            <Link to="/shop" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
              Explore the Collection
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <button onClick={() => repeatOrder(orders[0])} className="w-full rounded-xl bg-[#1b261b] px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#4a7333]">Order these teas again</button>
            {orders.map((order) => (
              <Link
                key={order.number}
                to={`/order/${order.number}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-[#1b261b]/10 rounded-2xl p-6 hover:border-[#8bb56e] transition-colors group"
              >
                <div>
                  <p className="text-sm font-bold font-mono group-hover:text-[#4a7333] transition-colors">{order.number}</p>
                  <p className="text-[11px] text-[#4a584a] mt-1">
                    {new Date(order.placedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {' · '}
                    {order.items.reduce((acc, i) => acc + i.quantity, 0)} items
                  </p>
                </div>
                <span className="text-sm font-bold font-mono">{formatINR(order.total)}</span>
              </Link>
            ))}
          </div>
        )}
        <p className="text-[11px] font-mono text-[#4a584a] mt-6">
          Demo store — orders are stored in this browser only.
        </p>
      </div>
    </div>
  )
}
