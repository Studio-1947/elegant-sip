import { useState } from 'react'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'

type Step = 1 | 2 | 3

interface FormState {
  email: string
  firstName: string
  lastName: string
  address: string
  city: string
  zip: string
  country: string
  cardNumber: string
  cardName: string
  expiry: string
  cvc: string
}

const EMPTY_FORM: FormState = {
  email: '',
  firstName: '',
  lastName: '',
  address: '',
  city: '',
  zip: '',
  country: 'United States',
  cardNumber: '',
  cardName: '',
  expiry: '',
  cvc: '',
}

export default function CheckoutPage() {
  const { cart, cartTotal, discount, coupon, clearCart } = useCart()
  const { user } = useAuth()
  const { openLogin } = useUi()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [orderNumber, setOrderNumber] = useState<string | null>(null)

  useDocumentMeta('Checkout — Elegant Sip', 'Secure checkout for your Elegant Sip order.')

  const subtotal = cartTotal
  const shippingFee = subtotal - discount > 50 ? 0 : 5.0
  const estimatedTax = Math.round((subtotal - discount) * 0.08 * 100) / 100
  const finalTotal = Math.round((subtotal - discount + shippingFee + estimatedTax) * 100) / 100

  const setField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  const validateStep1 = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.email.includes('@')) next.email = 'Enter a valid email.'
    if (!form.firstName.trim()) next.firstName = 'Required.'
    if (!form.lastName.trim()) next.lastName = 'Required.'
    if (!form.address.trim()) next.address = 'Required.'
    if (!form.city.trim()) next.city = 'Required.'
    if (!/^\d{4,6}$/.test(form.zip.trim())) next.zip = 'Enter a valid ZIP code.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const validateStep2 = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!/^\d{15,16}$/.test(form.cardNumber.replace(/\s/g, ''))) next.cardNumber = 'Enter a valid card number.'
    if (!form.cardName.trim()) next.cardName = 'Required.'
    if (!/^\d{2}\s?\/\s?\d{2}$/.test(form.expiry.trim())) next.expiry = 'Use MM/YY.'
    if (!/^\d{3,4}$/.test(form.cvc.trim())) next.cvc = '3–4 digits.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const goNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
      track('begin_checkout', { step: 2 })
    } else if (step === 2 && validateStep2()) {
      setStep(3)
    }
  }

  const placeOrder = () => {
    const num = `ES-${Date.now().toString().slice(-6)}`
    setOrderNumber(num)
    clearCart()
    track('purchase', { order: num, value: finalTotal, items: cart.length })
    window.scrollTo(0, 0)
  }

  if (orderNumber) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6">
        <div className="max-w-lg mx-auto text-center bg-white border border-[#1b261b]/10 rounded-3xl p-10 md:p-14 shadow-[0_12px_40px_rgba(27,38,27,0.04)]">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#8bb56e]/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#8bb56e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <span className="text-[#8bb56e] text-xs font-mono tracking-[0.3em] uppercase block mb-3">Order Confirmed</span>
          <h1 className="text-3xl font-bold uppercase tracking-tight mb-4">Thank you!</h1>
          <p className="text-sm text-[#4a584a] leading-relaxed mb-6">
            Your order <span className="font-mono font-bold text-[#1b261b]">{orderNumber}</span> is being packed
            and will ship within 24 hours. A confirmation has been sent to your email.
          </p>
          <p className="text-xs text-[#4a584a]/70 italic mb-8">"Every cup is a snapshot of a place and a moment."</p>
          <div className="flex flex-col gap-3">
            <Link to="/shop" className="w-full bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-colors text-center">
              Continue Shopping
            </Link>
            <Link to="/" className="w-full border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 rounded-lg transition-all text-center">
              Back to Experience
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-40 pb-24 px-6 text-center">
        <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
        <p className="text-sm text-[#4a584a] mb-8">Add a few teas before heading to checkout.</p>
        <Link to="/shop" className="inline-block bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3 px-8 rounded-lg transition-colors">
          Browse the Collection
        </Link>
      </div>
    )
  }

  const inputClass = (field: keyof FormState) =>
    `w-full bg-white border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25 ${
      errors[field] ? 'border-red-400' : 'border-[#1b261b]/15'
    }`

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/cart" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#8bb56e] transition-colors">
              ← Back to Cart
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mt-3">Checkout</h1>
          </div>
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase">
            {([1, 2, 3] as Step[]).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${
                    step >= s ? 'bg-[#8bb56e] border-[#8bb56e] text-white' : 'border-[#1b261b]/20 text-[#4a584a]'
                  }`}
                >
                  {s}
                </span>
                <span className={step >= s ? 'text-[#1b261b]' : 'text-[#4a584a]/60'}>
                  {s === 1 ? 'Shipping' : s === 2 ? 'Payment' : 'Review'}
                </span>
                {s < 3 && <span className="w-6 h-px bg-[#1b261b]/15" />}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Form */}
          <div className="lg:col-span-2 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-10">
            {step === 1 && (
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Shipping Information</h2>
                {!user && (
                  <div className="bg-[#8bb56e]/5 border border-[#8bb56e]/20 rounded-xl p-4 mb-6 text-xs text-[#4a584a] flex items-center justify-between gap-4">
                    <span>Have an account? Check out faster with saved details.</span>
                    <button onClick={openLogin} className="text-[#8bb56e] font-bold uppercase tracking-widest hover:text-[#1b261b] transition-colors flex-shrink-0 cursor-pointer">
                      Sign In
                    </button>
                  </div>
                )}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="co-email" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Email</label>
                    <input id="co-email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="you@example.com" className={inputClass('email')} />
                    {errors.email && <p className="text-[11px] text-red-600 mt-1">{errors.email}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-first" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">First Name</label>
                      <input id="co-first" type="text" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} placeholder="Avery" className={inputClass('firstName')} />
                      {errors.firstName && <p className="text-[11px] text-red-600 mt-1">{errors.firstName}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-last" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Last Name</label>
                      <input id="co-last" type="text" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} placeholder="Chen" className={inputClass('lastName')} />
                      {errors.lastName && <p className="text-[11px] text-red-600 mt-1">{errors.lastName}</p>}
                    </div>
                  </div>
                  <div>
                    <label htmlFor="co-address" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Address</label>
                    <input id="co-address" type="text" value={form.address} onChange={(e) => setField('address', e.target.value)} placeholder="Street address" className={inputClass('address')} />
                    {errors.address && <p className="text-[11px] text-red-600 mt-1">{errors.address}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-city" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">City</label>
                      <input id="co-city" type="text" value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Portland" className={inputClass('city')} />
                      {errors.city && <p className="text-[11px] text-red-600 mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-zip" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">ZIP</label>
                      <input id="co-zip" type="text" value={form.zip} onChange={(e) => setField('zip', e.target.value)} placeholder="97201" className={inputClass('zip')} />
                      {errors.zip && <p className="text-[11px] text-red-600 mt-1">{errors.zip}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Payment</h2>
                <p className="text-[10px] text-[#4a584a]/70 mb-6">
                  Demo checkout — no payment is processed. Use any card format, e.g. 4242 4242 4242 4242.
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="co-card" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Card Number</label>
                    <input
                      id="co-card"
                      type="text"
                      inputMode="numeric"
                      value={form.cardNumber}
                      onChange={(e) => setField('cardNumber', e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                      placeholder="4242 4242 4242 4242"
                      className={inputClass('cardNumber')}
                    />
                    {errors.cardNumber && <p className="text-[11px] text-red-600 mt-1">{errors.cardNumber}</p>}
                  </div>
                  <div>
                    <label htmlFor="co-cardname" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Name on Card</label>
                    <input id="co-cardname" type="text" value={form.cardName} onChange={(e) => setField('cardName', e.target.value)} placeholder="Avery Chen" className={inputClass('cardName')} />
                    {errors.cardName && <p className="text-[11px] text-red-600 mt-1">{errors.cardName}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-expiry" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Expiry</label>
                      <input id="co-expiry" type="text" value={form.expiry} onChange={(e) => setField('expiry', e.target.value)} placeholder="MM/YY" className={inputClass('expiry')} />
                      {errors.expiry && <p className="text-[11px] text-red-600 mt-1">{errors.expiry}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-cvc" className="block text-[10px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">CVC</label>
                      <input id="co-cvc" type="text" inputMode="numeric" value={form.cvc} onChange={(e) => setField('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" className={inputClass('cvc')} />
                      {errors.cvc && <p className="text-[11px] text-red-600 mt-1">{errors.cvc}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Review Your Order</h2>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 border border-[#1b261b]/10 rounded-xl p-3">
                      <img src={item.imageSrc} alt={item.name} className="w-14 h-16 object-cover rounded-lg" />
                      <div className="flex-grow">
                        <p className="text-sm font-bold">{item.name}</p>
                        <p className="text-[11px] text-[#4a584a]">Qty {item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold">${item.price * item.quantity}.00</span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#f9faf7] border border-[#1b261b]/10 rounded-xl p-4 text-xs space-y-1.5 text-[#4a584a]">
                  <p><span className="font-bold text-[#1b261b]">Ship to:</span> {form.firstName} {form.lastName}, {form.address}, {form.city} {form.zip}, {form.country}</p>
                  <p><span className="font-bold text-[#1b261b]">Contact:</span> {form.email}</p>
                  <p><span className="font-bold text-[#1b261b]">Card:</span> •••• {form.cardNumber.replace(/\s/g, '').slice(-4) || '4242'}</p>
                </div>
                <p className="text-[10px] text-[#4a584a]/60 mt-4">By placing your order you agree to our Terms & Conditions.</p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-4 mt-10">
              {step > 1 && (
                <button
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-all cursor-pointer"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  onClick={goNext}
                  className="flex-grow bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  Continue
                </button>
              ) : (
                <button
                  onClick={placeOrder}
                  className="flex-grow bg-[#8bb56e] hover:bg-[#9cc580] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  Place Order • ${finalTotal.toFixed(2)}
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-8 shadow-[0_12px_40px_rgba(27,38,27,0.04)] lg:sticky lg:top-28">
            <h2 className="text-lg font-bold uppercase tracking-wide border-b border-[#1b261b]/10 pb-4 mb-6">Order Summary</h2>
            <div className="space-y-3 text-xs mb-6">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between gap-3">
                  <span className="text-[#4a584a]">{item.name} <span className="text-[#4a584a]/60">× {item.quantity}</span></span>
                  <span className="font-mono font-semibold">${item.price * item.quantity}.00</span>
                </div>
              ))}
            </div>
            <div className="space-y-2.5 text-xs border-t border-[#1b261b]/10 pt-4">
              <div className="flex justify-between text-[#4a584a]">
                <span>Subtotal</span>
                <span className="font-mono">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-[#8bb56e]">
                  <span>Discount ({coupon})</span>
                  <span className="font-mono">−${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#4a584a]">
                <span>Shipping</span>
                <span className="font-mono">{shippingFee === 0 ? 'Free' : `$${shippingFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between text-[#4a584a]">
                <span>Estimated Tax (8%)</span>
                <span className="font-mono">${estimatedTax.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#1b261b]/10 pt-3 mt-3 flex justify-between text-base font-bold">
                <span>Total</span>
                <span className="font-mono">${finalTotal.toFixed(2)}</span>
              </div>
            </div>
            <p className="text-[10px] font-mono text-[#8bb56e] italic mt-4">🔒 Demo checkout — no real payment is processed.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
