import { useEffect, useState } from 'react'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../lib/pricing'
import { saveOrder, getOrders } from '../lib/orders'
import { formatINR } from '../lib/currency'
import { EMPTY_FORM, GENERIC_POSTAL, POSTAL_RULES, type FormState, type Step } from './checkout/checkoutData'
import { EmptyCartScreen, OrderConfirmedScreen } from './checkout/CheckoutScreens'
import CheckoutSummary from './checkout/CheckoutSummary'
import ShippingStep from './checkout/ShippingStep'

export default function CheckoutPage() {
  const { cart, cartTotal, discount, coupon, clearCart } = useCart()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>('standard')
  const [placing, setPlacing] = useState(false)
  const [prefilled, setPrefilled] = useState(false)

  // Prefill from the signed-in user and the most recent order on this device.
  useEffect(() => {
    const last = getOrders()[0]
    if (!user && !last) return
    const [lastFirst = '', ...lastRest] = (last?.name ?? '').split(' ')
    setForm((f) => {
      const next = {
        ...f,
        email: f.email || user?.email || last?.email || '',
        firstName: f.firstName || lastFirst,
        lastName: f.lastName || lastRest.join(' '),
        address: f.address || last?.address || '',
        city: f.city || last?.city || '',
        zip: f.zip || last?.zip || '',
        country: last?.country || f.country,
      }
      if (next.email || next.address) setPrefilled(true)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useDocumentMeta('Checkout  Elegant Sip', 'Secure checkout for your Elegant Sip order.')

  const subtotal = cartTotal
  const { shippingFee, estimatedTax, finalTotal } = getOrderPricing(cartTotal, discount, shippingMethod)

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
    const postal = POSTAL_RULES[form.country] ?? GENERIC_POSTAL
    if (!postal.pattern.test(form.zip.trim())) next.zip = postal.hint
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
    if (placing || orderNumber) return
    setPlacing(true)
    const num = `ES-${Date.now().toString().slice(-6)}`
    const notes = localStorage.getItem('elegant_sip_order_notes') || ''
    saveOrder({
      number: num,
      date: new Date().toISOString(),
      items: cart,
      subtotal,
      discount,
      coupon,
      shippingFee,
      tax: estimatedTax,
      total: finalTotal,
      shippingMethod,
      email: form.email,
      name: `${form.firstName} ${form.lastName}`.trim(),
      address: form.address,
      city: form.city,
      zip: form.zip,
      country: form.country,
      ...(notes ? { notes } : {}),
    })
    localStorage.removeItem('elegant_sip_order_notes')
    setOrderNumber(num)
    clearCart()
    track('purchase', { order: num, value: finalTotal, items: cart.length })
    window.scrollTo(0, 0)
  }

  if (orderNumber) {
    return <OrderConfirmedScreen orderNumber={orderNumber} />
  }

  if (cart.length === 0) {
    return <EmptyCartScreen />
  }

  const inputClass = (field: keyof FormState) =>
    `w-full bg-white border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#8bb56e] transition-colors placeholder:text-[#1b261b]/25 ${errors[field] ? 'border-red-400' : 'border-[#1b261b]/15'
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
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${step >= s ? 'bg-[#8bb56e] border-[#8bb56e] text-white' : 'border-[#1b261b]/20 text-[#4a584a]'
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
              <ShippingStep
                form={form}
                errors={errors}
                setField={setField}
                inputClass={inputClass}
                prefilled={prefilled}
                shippingMethod={shippingMethod}
                setShippingMethod={setShippingMethod}
                cartTotal={cartTotal}
                discount={discount}
              />
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Payment</h2>
                <p className="text-[10px] text-[#4a584a]/70 mb-6">
                  Demo checkout  no payment is processed. Use any card format, e.g. 4242 4242 4242 4242.
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
                    <div key={`${item.id}__${item.size}`} className="flex items-center gap-4 border border-[#1b261b]/10 rounded-xl p-3">
                      <img src={item.imageSrc} alt={item.name} className="w-14 h-16 object-cover rounded-lg" />
                      <div className="flex-grow">
                        <p className="text-sm font-bold">{item.name}</p>
                        <p className="text-[11px] text-[#4a584a]">{item.size} · Qty {item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold">{formatINR(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-[#f9faf7] border border-[#1b261b]/10 rounded-xl p-4 text-xs space-y-1.5 text-[#4a584a]">
                  <p><span className="font-bold text-[#1b261b]">Ship to:</span> {form.firstName} {form.lastName}, {form.address}, {form.city} {form.zip}, {form.country}</p>
                  <p><span className="font-bold text-[#1b261b]">Shipping:</span> {SHIPPING_METHODS.find((m) => m.id === shippingMethod)?.label} ({SHIPPING_METHODS.find((m) => m.id === shippingMethod)?.detail})</p>
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
                  disabled={placing}
                  className="flex-grow bg-[#8bb56e] hover:bg-[#9cc580] disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  {placing ? 'Placing Order…' : `Place Order • ${formatINR(finalTotal)}`}
                </button>
              )}
            </div>
          </div>

          {/* Summary */}
          <CheckoutSummary
            cart={cart}
            subtotal={subtotal}
            discount={discount}
            coupon={coupon}
            shippingFee={shippingFee}
            estimatedTax={estimatedTax}
            finalTotal={finalTotal}
          />
        </div>
      </div>
    </div>
  )
}
