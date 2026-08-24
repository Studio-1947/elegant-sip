import { useEffect, useState } from 'react'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../lib/pricing'
import { saveOrder, getOrders } from '../lib/orders'
import { formatINR } from '../lib/currency'
import {
  EMAIL_PATTERN,
  EMPTY_FORM,
  FIELD_IDS,
  GENERIC_POSTAL,
  POSTAL_RULES,
  luhn,
  type FormState,
  type Step,
} from './checkout/checkoutData'
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

  // Prefill only for a signed-in visitor. Orders are stored per-device, so
  // prefilling a signed-out visitor would disclose the previous customer's
  // name, email and street address on any shared or family machine.
  useEffect(() => {
    if (!user) return
    const last = getOrders()[0]
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

  useDocumentMeta('Checkout | Elegant Sip', 'Complete your Elegant Sip order.', { noindex: true })

  const subtotal = cartTotal
  const { shippingFee, estimatedTax, finalTotal } = getOrderPricing(cartTotal, discount, shippingMethod)

  const setField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  /** Move focus to the first field that failed, so the error is discoverable. */
  const focusFirstError = (next: Partial<Record<keyof FormState, string>>) => {
    const order: (keyof FormState)[] = [
      'email', 'firstName', 'lastName', 'address', 'city', 'zip',
      'cardNumber', 'cardName', 'expiry', 'cvc',
    ]
    const first = order.find((field) => next[field])
    if (!first) return
    window.requestAnimationFrame(() => {
      document.getElementById(FIELD_IDS[first])?.focus()
    })
  }

  const validateStep1 = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.'
    if (!form.address.trim()) next.address = 'Enter your street address.'
    if (!form.city.trim()) next.city = 'Enter your city.'
    const postal = POSTAL_RULES[form.country] ?? GENERIC_POSTAL
    if (!postal.pattern.test(form.zip.trim())) next.zip = postal.hint
    setErrors(next)
    if (Object.keys(next).length > 0) focusFirstError(next)
    return Object.keys(next).length === 0
  }

  const validateStep2 = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    const pan = form.cardNumber.replace(/\s/g, '')
    // Real PANs run 13–19 digits; Luhn catches transposed digits.
    if (!/^\d{13,19}$/.test(pan) || !luhn(pan)) next.cardNumber = 'Enter a valid card number.'
    if (!form.cardName.trim()) next.cardName = 'Enter the name on the card.'
    const expiry = form.expiry.trim().match(/^(\d{2})\s?\/\s?(\d{2})$/)
    if (!expiry || Number(expiry[1]) < 1 || Number(expiry[1]) > 12) next.expiry = 'Use MM/YY, e.g. 04/28.'
    if (!/^\d{3,4}$/.test(form.cvc.trim())) next.cvc = 'Enter the 3–4 digit code.'
    setErrors(next)
    if (Object.keys(next).length > 0) focusFirstError(next)
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

  /** Enter submits the current step rather than doing nothing. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 3) goNext()
    else placeOrder()
  }

  const placeOrder = () => {
    if (placing || orderNumber) return
    setPlacing(true)
    // Date-prefixed plus a random suffix: the previous low-6-digits-of-now
    // scheme collided every ~16.7 minutes, and getOrder() returns the first
    // match, so a collision showed the wrong customer their order.
    const now = new Date()
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
    const num = `ES-${stamp}-${rand}`
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
    `w-full bg-white border rounded-lg px-4 py-3 text-sm focus:border-[#4a7333] transition-colors placeholder:text-[#1b261b]/45 ${errors[field] ? 'border-red-600' : 'border-[#1b261b]/15'
    }`

  /** ARIA wiring for a field: invalid state + a pointer to its error message. */
  const fieldProps = (field: keyof FormState) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${FIELD_IDS[field]}-error` : undefined,
  })

  return (
    <div className="min-h-screen bg-[#f9faf7] text-[#1b261b] font-sans pt-32 pb-24 px-6 md:px-12 lg:px-24">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/cart" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#4a7333] transition-colors">
              ← Back to Cart
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mt-3">Checkout</h1>
          </div>
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase">
            {([1, 2, 3] as Step[]).map((s) => (
              <li key={s} className="flex items-center gap-2" aria-current={step === s ? 'step' : undefined}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${step >= s ? 'bg-[#8bb56e] border-[#8bb56e] text-white' : 'border-[#1b261b]/20 text-[#4a584a]'
                    }`}
                >
                  {s}
                </span>
                <span className={step >= s ? 'text-[#1b261b]' : 'text-[#4a584a]'}>
                  {s === 1 ? 'Shipping' : s === 2 ? 'Payment' : 'Review'}
                </span>
                {s < 3 && <span className="w-6 h-px bg-[#1b261b]/15" />}
              </li>
            ))}
          </ol>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            className="lg:col-span-2 bg-white border border-[#1b261b]/10 rounded-2xl p-6 md:p-10"
          >
            {step === 1 && (
              <ShippingStep
                form={form}
                errors={errors}
                setField={setField}
                inputClass={inputClass}
                fieldProps={fieldProps}
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
                <p className="text-[11px] text-[#4a584a] mb-6">
                  Demo checkout — no payment is processed. Use any card format, e.g. 4242 4242 4242 4242.
                </p>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="co-card" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Card Number</label>
                    <input
                      id="co-card"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      {...fieldProps('cardNumber')}
                      value={form.cardNumber}
                      onChange={(e) => setField('cardNumber', e.target.value.replace(/[^\d\s]/g, '').slice(0, 19))}
                      placeholder="4242 4242 4242 4242"
                      className={inputClass('cardNumber')}
                    />
                    {errors.cardNumber && <p id="co-card-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.cardNumber}</p>}
                  </div>
                  <div>
                    <label htmlFor="co-cardname" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Name on Card</label>
                    <input id="co-cardname" type="text" autoComplete="off" value={form.cardName} onChange={(e) => setField('cardName', e.target.value)} placeholder="Avery Chen" className={inputClass('cardName')} {...fieldProps('cardName')} />
                    {errors.cardName && <p id="co-cardname-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.cardName}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="co-expiry" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">Expiry</label>
                      <input id="co-expiry" type="text" autoComplete="off" value={form.expiry} onChange={(e) => setField('expiry', e.target.value)} placeholder="MM/YY" className={inputClass('expiry')} {...fieldProps('expiry')} />
                      {errors.expiry && <p id="co-expiry-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.expiry}</p>}
                    </div>
                    <div>
                      <label htmlFor="co-cvc" className="block text-[11px] font-mono tracking-widest uppercase text-[#4a584a] mb-1.5">CVC</label>
                      <input id="co-cvc" type="text" inputMode="numeric" autoComplete="off" {...fieldProps('cvc')} value={form.cvc} onChange={(e) => setField('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="123" className={inputClass('cvc')} />
                      {errors.cvc && <p id="co-cvc-error" role="alert" className="text-[11px] text-red-700 mt-1">{errors.cvc}</p>}
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
                <p className="text-[11px] text-[#4a584a] mt-4">By placing your order you agree to our Terms & Conditions.</p>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex gap-4 mt-10">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  className="border border-[#1b261b]/20 hover:border-[#1b261b] hover:bg-[#f9faf7] text-[#1b261b] text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-all cursor-pointer"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="submit"
                  className="flex-grow bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={placing}
                  className="flex-grow bg-[#8bb56e] hover:bg-[#9cc580] disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  {placing ? 'Placing Order…' : `Place Order • ${formatINR(finalTotal)}`}
                </button>
              )}
            </div>
          </form>

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
