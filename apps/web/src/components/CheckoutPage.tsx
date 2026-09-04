import { useEffect, useState } from 'react'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../lib/pricing'
import { api, ApiClientError, type SavedAddress } from '../lib/api'
import { formatINR } from '../lib/currency'
import {
  EMAIL_PATTERN,
  EMPTY_FORM,
  FIELD_IDS,
  GENERIC_POSTAL,
  POSTAL_RULES,
  type FormState,
  type Step,
} from './checkout/checkoutData'
import { EmptyCartScreen, OrderConfirmedScreen } from './checkout/CheckoutScreens'
import CheckoutSummary from './checkout/CheckoutSummary'
import ShippingStep from './checkout/ShippingStep'

type RazorpayInstance = { open: () => void }
type RazorpayConstructor = new (options: {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string }
  theme: { color: string }
  handler: () => void
  modal: { ondismiss: () => void }
}) => RazorpayInstance

function loadRazorpay(): Promise<RazorpayConstructor> {
  const available = (window as typeof window & { Razorpay?: RazorpayConstructor }).Razorpay
  if (available) return Promise.resolve(available)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as typeof window & { Razorpay: RazorpayConstructor }).Razorpay), { once: true })
      existing.addEventListener('error', () => reject(new Error('Razorpay checkout could not load.')), { once: true })
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve((window as typeof window & { Razorpay: RazorpayConstructor }).Razorpay)
    script.onerror = () => reject(new Error('Razorpay checkout could not load.'))
    document.head.appendChild(script)
  })
}

const CHECKOUT_ATTEMPT_KEY = 'elegant_sip_checkout_attempt'

function checkoutAttempt() {
  const stored = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as { idempotencyKey?: string; guestAccessToken?: string }
      if (parsed.idempotencyKey && parsed.guestAccessToken) return parsed as { idempotencyKey: string; guestAccessToken: string }
    } catch {
      // Replace malformed browser state with a fresh safe attempt.
    }
  }
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  const attempt = {
    idempotencyKey: crypto.randomUUID(),
    guestAccessToken: btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''),
  }
  sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, JSON.stringify(attempt))
  return attempt
}

export default function CheckoutPage() {
  const { cart, cartTotal, discount, coupon, clearCart, quote, toCartLines } = useCart()
  const { user } = useAuth()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<Awaited<ReturnType<typeof api.orders.place>> | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>('standard')
  const [placing, setPlacing] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [saveAddress, setSaveAddress] = useState(false)
  const [paymentsAvailable, setPaymentsAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void api.storefront.status().then((status) => !cancelled && setPaymentsAvailable(status.paymentsAvailable)).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Prefill only for a signed-in visitor. Orders are stored per-device, so
  // prefilling a signed-out visitor would disclose the previous customer's
  // name, email and street address on any shared or family machine.
  useEffect(() => {
    if (!user) return
    const [first = '', ...rest] = user.name.split(' ')
    setForm((f) => {
      const next = { ...f, email: f.email || user.email, firstName: f.firstName || first, lastName: f.lastName || rest.join(' ') }
      if (next.email) setPrefilled(true)
      return next
    })
  }, [user])

  useEffect(() => {
    if (!user) { setSavedAddresses([]); return }
    let cancelled = false
    void api.account.addresses().then((result) => !cancelled && setSavedAddresses(result.addresses)).catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const selectSavedAddress = (address: SavedAddress) => {
    const parts = address.name.trim().split(/\s+/)
    setForm((current) => ({ ...current, email: current.email || user?.email || '', firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), address: address.line1, city: address.city, state: address.state ?? '', zip: address.postalCode, country: address.country }))
    setErrors({})
    setPrefilled(true)
  }

  useDocumentMeta('Checkout | Elegant Sip', 'Complete your Elegant Sip order.', { noindex: true })

  const subtotal = cartTotal
  const fallback = getOrderPricing(cartTotal, discount, shippingMethod)
  const shippingFee = quote?.shippingFee ?? fallback.shippingFee
  const estimatedTax = quote?.tax ?? fallback.estimatedTax
  const finalTotal = quote?.total ?? fallback.finalTotal

  const setField = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }

  /** Move focus to the first field that failed, so the error is discoverable. */
  const focusFirstError = (next: Partial<Record<keyof FormState, string>>) => {
    const order: (keyof FormState)[] = [
      'email', 'firstName', 'lastName', 'address', 'city', 'zip',
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

  const goNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2)
      track('begin_checkout', { step: 2 })
    }
  }

  /** Enter submits the current step rather than doing nothing. */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step < 2) goNext()
    else void placeOrder()
  }

  /*
   * Places the order.
   *
   * The request carries no prices — only which tea, which tier, how many, and
   * where it is going. The server re-prices from the catalogue, reserves stock
   * in a transaction and hands back the gateway handle.
   *
   * The order comes back as `pending_payment`. It is NOT paid: only a signed
   * webhook makes it so, which is why nothing here claims payment succeeded.
   */
  const placeOrder = async () => {
    if (placing || orderNumber) return
    setPlacing(true)
    setOrderError(null)
    try {
      const notes = localStorage.getItem('elegant_sip_order_notes') || ''
      const attempt = checkoutAttempt()
      const result = await api.orders.place({
        items: toCartLines(),
        email: form.email,
        shipping: {
          name: `${form.firstName} ${form.lastName}`.trim(),
          line1: form.address,
          city: form.city,
          postalCode: form.zip,
          state: form.state || undefined,
          country: 'India',
        },
        shippingMethod,
        ...(coupon ? { couponCode: coupon } : {}),
        ...(notes ? { notes } : {}),
      }, { idempotencyKey: attempt.idempotencyKey, ...(user ? {} : { guestAccessToken: attempt.guestAccessToken }) })

      if (user && saveAddress) {
        // A failed save must not turn a successful checkout into an apparent failure.
        void api.account.saveAddress({ label: 'Checkout address', name: `${form.firstName} ${form.lastName}`.trim(), line1: form.address, city: form.city, postalCode: form.zip, state: form.state || null, country: 'India', phone: null, isDefault: savedAddresses.length === 0 }).catch(() => {})
      }

      localStorage.removeItem('elegant_sip_order_notes')
      sessionStorage.removeItem(CHECKOUT_ATTEMPT_KEY)
      if (result.guestAccessToken) {
        // Not included in URLs, browser history, referrers, or persistent local storage.
        sessionStorage.setItem(`elegant_sip_order_access_${result.order.number}`, result.guestAccessToken)
      }
      setOrderNumber(result.order.number)
      setPlacedOrder(result)
      clearCart()
      track('purchase', { order: result.order.number, value: result.order.total, items: result.order.items.length })
      if (result.payment.provider === 'razorpay') {
        const Razorpay = await loadRazorpay()
        new Razorpay({
          key: result.payment.publicKey,
          amount: result.payment.amount,
          currency: result.payment.currency,
          name: 'Elegant Sip',
          description: `Order ${result.order.number}`,
          order_id: result.payment.gatewayOrderId,
          prefill: { name: `${form.firstName} ${form.lastName}`.trim(), email: form.email },
          theme: { color: '#4a7333' },
          // This only updates the browser experience. A signed webhook remains
          // the sole authority for changing the server-side order to paid.
          handler: () => window.scrollTo(0, 0),
          modal: { ondismiss: () => window.scrollTo(0, 0) },
        }).open()
      }
      window.scrollTo(0, 0)
    } catch (err) {
      /* A rejected order usually means the cart moved under the customer —
         something sold out, or a price changed. Say so plainly and leave the
         cart intact so they can adjust it. */
      setOrderError(
        err instanceof ApiClientError
          ? err.message
          : 'We could not place that order. Nothing has been charged — please try again.',
      )
      window.scrollTo(0, 0)
    } finally {
      setPlacing(false)
    }
  }

  if (orderNumber) {
    return <OrderConfirmedScreen orderNumber={orderNumber} order={placedOrder?.order ?? null} paymentProvider={placedOrder?.payment.provider} paymentError={orderError} />
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
        {orderError && (
          <div role="alert" className="mb-8 border-l-4 border-red-700 bg-red-50 rounded-r-lg px-5 py-4">
            <p className="text-xs font-mono font-bold tracking-widest uppercase text-red-800 mb-1">
              Order not placed
            </p>
            <p className="text-sm text-[#45523f]">{orderError}</p>
          </div>
        )}
        {paymentsAvailable === false && (
          <div role="status" className="mb-8 border-l-4 border-amber-600 bg-amber-50 rounded-r-lg px-5 py-4">
            <p className="text-xs font-mono font-bold tracking-widest uppercase text-amber-900 mb-1">Online checkout is coming soon</p>
            <p className="text-sm text-[#45523f]">You can explore the full collection, but we are not accepting online orders yet.</p>
          </div>
        )}
        <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link to="/cart" className="text-xs font-mono tracking-widest uppercase text-[#4a584a] hover:text-[#4a7333] transition-colors">
              ← Back to Cart
            </Link>
            <h1 className="text-4xl md:text-5xl font-bold uppercase tracking-tight mt-3">Checkout</h1>
          </div>
          {/* Stepper */}
          <ol className="flex items-center gap-2 text-[11px] font-mono tracking-widest uppercase">
            {([1, 2] as Step[]).map((s) => (
              <li key={s} className="flex items-center gap-2" aria-current={step === s ? 'step' : undefined}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center border transition-colors ${step >= s ? 'bg-[#8bb56e] border-[#8bb56e] text-white' : 'border-[#1b261b]/20 text-[#4a584a]'
                    }`}
                >
                  {s}
                </span>
                <span className={step >= s ? 'text-[#1b261b]' : 'text-[#4a584a]'}>
                  {s === 1 ? 'Shipping' : 'Review'}
                </span>
                {s < 2 && <span className="w-6 h-px bg-[#1b261b]/15" />}
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
                savedAddresses={savedAddresses}
                selectSavedAddress={selectSavedAddress}
                saveAddress={saveAddress}
                setSaveAddress={setSaveAddress}
              />
            )}

            {step === 2 && (
              <div>
                <h2 className="text-lg font-bold uppercase tracking-wide mb-6">Review Your Order</h2>
                <div className="space-y-3 mb-6">
                  {cart.map((item) => (
                    <div key={`${item.productSlug}__${item.size}`} className="flex items-center gap-4 border border-[#1b261b]/10 rounded-xl p-3">
                      <img src={item.imageSrc} alt={item.name} loading="lazy" width={56} height={64} className="w-14 h-16 object-cover rounded-lg" />
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
              {step < 2 ? (
                <button
                  type="submit"
                  className="flex-grow bg-[#1b261b] hover:bg-[#2b3a2b] text-white text-xs font-bold tracking-widest uppercase py-3.5 px-8 rounded-lg transition-colors cursor-pointer"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={placing || paymentsAvailable === false}
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
