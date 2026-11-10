import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { useCart } from './CartContext'
import { useEffect, useState } from 'react'
import { api, type OrderView } from '../lib/api'
import { ApiClientError } from '../lib/api'
import { formatINR } from '../lib/currency'
import { indianMobileError, normaliseIndianMobile, phoneInputDigits } from '@elegantsip/shared'
import { isShipmentProblem, shipmentSummary } from '../lib/shipment'
import { Link, navigate, useDocumentMeta } from '../lib/router'
import AddressBookSection from './account/AddressBookSection'
import { formatDate } from '../lib/dates'

const ORDER_STATUS: Record<OrderView['status'], { label: string; tone: string }> = {
  pending_payment: { label: 'Awaiting payment', tone: 'bg-amber-50 text-amber-800' },
  paid: { label: 'Paid', tone: 'bg-[#8bb56e]/15 text-[#4a7333]' },
  packed: { label: 'Packed', tone: 'bg-[#8bb56e]/15 text-[#4a7333]' },
  shipped: { label: 'Shipped', tone: 'bg-sky-50 text-sky-800' },
  delivered: { label: 'Delivered', tone: 'bg-[#1b261b] text-white' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-50 text-rose-700' },
  refunded: { label: 'Refunded', tone: 'bg-[#1b261b]/5 text-[#4a584a]' },
}

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
      const clearLoading = window.setTimeout(() => setLoadingOrders(false), 0)
      return () => window.clearTimeout(clearLoading)
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
    const local = normaliseIndianMobile(phone)
    if (!local) { setPhoneMessage(indianMobileError(phone)); return }
    setPhoneMessage(null); setPhoneBusy(true)
    try { const result = await api.account.requestWhatsApp(`+91${local}`); setPhoneChallenge(result.challengeId); setPhoneMessage('A code has been sent to WhatsApp.') }
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
            {!user.emailIsPlaceholder && !user.email.endsWith('.invalid') && <p className="text-xs font-mono text-[#4a584a] mt-3">{user.email}</p>}
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
          {!phoneChallenge ? <div className="flex flex-col sm:flex-row gap-3"><div className="flex flex-1"><span aria-hidden="true" className="inline-flex items-center rounded-l-lg border border-r-0 border-[#1b261b]/15 bg-[#1b261b]/[0.04] px-3 text-sm font-mono text-[#4a584a]">+91</span><input value={phone} onChange={(e) => setPhone(phoneInputDigits(e.target.value))} placeholder="98765 43210" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={16} aria-label="WhatsApp number (10-digit Indian mobile)" className="flex-1 min-w-0 border border-[#1b261b]/15 rounded-r-lg px-4 py-3 text-sm" /></div><button onClick={() => void requestWhatsAppLink()} disabled={phoneBusy} className="bg-[#1b261b] text-white text-xs font-bold uppercase tracking-widest rounded-lg px-5 py-3">{phoneBusy ? 'Sending…' : 'Link WhatsApp'}</button></div> : <div className="flex flex-col sm:flex-row gap-3"><input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" inputMode="numeric" className="flex-1 border border-[#1b261b]/15 rounded-lg px-4 py-3 text-sm tracking-[0.25em]" /><button onClick={() => void verifyWhatsAppLink()} disabled={phoneBusy || phoneCode.length !== 6} className="bg-[#1b261b] text-white text-xs font-bold uppercase tracking-widest rounded-lg px-5 py-3">Verify number</button></div>}
          {phoneMessage && <p role="status" className="text-xs text-[#4a584a] mt-3">{phoneMessage}</p>}
        </section>

        <AddressBookSection />

        {/* Order history */}
        <h2 id="orders" className="scroll-mt-28 text-lg font-bold uppercase tracking-wide mb-2">My Orders</h2>
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold font-mono group-hover:text-[#4a7333] transition-colors">{order.number}</p>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider ${ORDER_STATUS[order.status].tone}`}>
                      {ORDER_STATUS[order.status].label}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#4a584a] mt-1">
                    {formatDate(order.placedAt)}
                    {' · '}
                    {order.items.reduce((acc, i) => acc + i.quantity, 0)} items
                  </p>
                  {shipmentSummary(order) && (
                    <p className={`mt-1.5 text-[11px] font-semibold ${order.shipment && isShipmentProblem(order.shipment.status) ? 'text-amber-800' : 'text-[#4a7333]'}`}>
                      {shipmentSummary(order)}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold font-mono">{formatINR(order.total)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
