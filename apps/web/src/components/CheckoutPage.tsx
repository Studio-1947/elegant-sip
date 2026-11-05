import { useCallback, useEffect, useState } from 'react'
import { useCart } from './CartContext'
import { useAuth } from './AuthContext'
import { useUi } from './UiContext'
import { Link, useDocumentMeta } from '../lib/router'
import { track } from '../lib/analytics'
import { getOrderPricing, SHIPPING_METHODS, type ShippingMethodId } from '../lib/pricing'
import { api, ApiClientError, type PlaceOrderResult, type SavedAddress } from '../lib/api'
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
import BillingAddressSection from './checkout/BillingAddressSection'

type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
type RazorpayFailure = { error?: { description?: string } }
type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void
}
type RazorpayConstructor = new (options: {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string; contact?: string }
  theme: { color: string }
  handler: (response: RazorpaySuccess) => void
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
const INDIAN_MOBILE = /^[6-9]\d{9}$/

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
  const { openLogin } = useUi()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [placedOrder, setPlacedOrder] = useState<PlaceOrderResult | null>(null)
  const [orderError, setOrderError] = useState<string | null>(null)
  const [paymentNotice, setPaymentNotice] = useState<string | null>(null)
  const [paying, setPaying] = useState(false)
  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>('standard')
  const [placing, setPlacing] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [saveAddress, setSaveAddress] = useState(false)
  const [sameAsShipping, setSameAsShipping] = useState(true)
  const [billingAddressId, setBillingAddressId] = useState<string | null>(null)
  const [billingAddressError, setBillingAddressError] = useState<string | null>(null)
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
    const prefill = window.setTimeout(() => {
      // WhatsApp sign-up stores stand-in email and name values; never copy those onto an order.
      const [first = '', ...rest] = user.nameIsPlaceholder ? [] : user.name.split(' ')
      const email = user.emailIsPlaceholder ? '' : user.email
      setForm((f) => {
        const next = { ...f, email: f.email || email, phone: f.phone || (user.phone ?? ''), firstName: f.firstName || first, lastName: f.lastName || rest.join(' ') }
        if (next.email) setPrefilled(true)
        return next
      })
    }, 0)
    return () => window.clearTimeout(prefill)
  }, [user])

  useEffect(() => {
    if (!user) {
      const clearAddresses = window.setTimeout(() => setSavedAddresses([]), 0)
      return () => window.clearTimeout(clearAddresses)
    }
    let cancelled = false
    void api.account.addresses().then((result) => !cancelled && setSavedAddresses(result.addresses)).catch(() => {})
    return () => { cancelled = true }
  }, [user])

  const selectSavedAddress = (address: SavedAddress) => {
    const parts = address.name.trim().split(/\s+/)
    setForm((current) => ({ ...current, phone: address.phone ?? current.phone, email: current.email || (user && !user.emailIsPlaceholder ? user.email : ''), firstName: parts[0] ?? '', lastName: parts.slice(1).join(' '), address: address.line1, city: address.city, state: address.state ?? '', zip: address.postalCode, country: address.country }))
    setErrors({})
    setPrefilled(true)
  }

  const selectedBillingAddress = savedAddresses.find((address) => address.id === billingAddressId)
    ?? savedAddresses.find((address) => address.isDefaultBilling)

  useDocumentMeta('Checkout | Elegant Sip', 'Complete your Elegant Sip order.', { noindex: true })

  const subtotal = cartTotal
  const fallback = getOrderPricing(cartTotal, discount, shippingMethod)
  const shippingFee = quote?.shippingFee ?? fallback.shippingFee
  const estimatedTax = quote?.tax ?? fallback.estimatedTax
  const finalTotal = quote?.total ?? fallback.finalTotal

  const setField = useCallback((field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: undefined }))
  }, [])

  /** Move focus to the first field that failed, so the error is discoverable. */
  const focusFirstError = (next: Partial<Record<keyof FormState, string>>) => {
    const order: (keyof FormState)[] = [
      'email', 'phone', 'firstName', 'lastName', 'address', 'city', 'zip',
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
    if (!INDIAN_MOBILE.test(form.phone.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, ''))) next.phone = 'Enter a 10-digit mobile number.'
    if (!form.firstName.trim()) next.firstName = 'Enter your first name.'
    if (!form.lastName.trim()) next.lastName = 'Enter your last name.'
    if (!form.address.trim()) next.address = 'Enter your street address.'
    if (!form.city.trim()) next.city = 'Enter your city.'
    const postal = POSTAL_RULES[form.country] ?? GENERIC_POSTAL
    if (!postal.pattern.test(form.zip.trim())) next.zip = postal.hint
    if (!sameAsShipping && !selectedBillingAddress) setBillingAddressError('Choose a billing address from your address book.')
    else setBillingAddressError(null)
    setErrors(next)
    if (Object.keys(next).length > 0) focusFirstError(next)
    return Object.keys(next).length === 0 && (sameAsShipping || Boolean(selectedBillingAddress))
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
      const shipping = {
        name: `${form.firstName} ${form.lastName}`.trim(),
        line1: form.address,
        city: form.city,
        postalCode: form.zip,
        state: form.state || undefined,
        country: 'India' as const,
        phone: form.phone.trim(),
      }
      const billing = sameAsShipping
        ? shipping
        : selectedBillingAddress && {
          name: selectedBillingAddress.name,
          line1: selectedBillingAddress.line1,
          city: selectedBillingAddress.city,
          postalCode: selectedBillingAddress.postalCode,
          state: selectedBillingAddress.state ?? undefined,
          country: 'India' as const,
          phone: selectedBillingAddress.phone ?? undefined,
        }
      if (!billing) {
        setBillingAddressError('Choose a billing address from your address book.')
        setStep(1)
        return
      }
      const result = await api.orders.place({
        items: toCartLines(),
        email: form.email,
        shipping,
        billing,
        shippingMethod,
        ...(coupon ? { couponCode: coupon } : {}),
        ...(notes ? { notes } : {}),
      }, { idempotencyKey: attempt.idempotencyKey, ...(user ? {} : { guestAccessToken: attempt.guestAccessToken }) })

      if (user && saveAddress) {
        // A failed save must not turn a successful checkout into an apparent failure.
        void api.account.saveAddress({ label: 'Checkout address', name: `${form.firstName} ${form.lastName}`.trim(), line1: form.address, city: form.city, postalCode: form.zip, state: form.state || undefined, country: 'India', phone: form.phone.trim() || undefined, isDefaultShipping: !savedAddresses.some((address) => address.isDefaultShipping), isDefaultBilling: sameAsShipping && !savedAddresses.some((address) => address.isDefaultBilling) }).catch(() => {})
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
      window.scrollTo(0, 0)
      void openPayment(result)
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

  /*
   * Opens Razorpay for a placed order. Safe to call again: Razorpay accepts
   * several attempts against one gateway order, so "Pay now" reuses it.
   */
  const openPayment = async (placed: PlaceOrderResult) => {
    if (placed.payment.provider !== 'razorpay') return
    setPaymentNotice(null)
    setPaying(true)
    let succeeded = false
    let lastFailure: string | null = null
    try {
      const Razorpay = await loadRazorpay()
      const checkout = new Razorpay({
        key: placed.payment.publicKey,
        amount: placed.payment.amount,
        currency: placed.payment.currency,
        name: 'Elegant Sip',
        description: `Order ${placed.order.number}`,
        order_id: placed.payment.gatewayOrderId,
        prefill: {
          name: `${form.firstName} ${form.lastName}`.trim(),
          email: form.email,
          // Already collected at checkout; spares the buyer Razorpay's contact prompt.
          contact: form.phone.replace(/\D/g, '').slice(-10) || undefined,
        },
        theme: { color: '#4a7333' },
        handler: (response) => {
          succeeded = true
          void confirmPayment(placed, response)
        },
        modal: {
          ondismiss: () => {
            if (succeeded) return
            setPaying(false)
            setPaymentNotice(
              lastFailure
                ? `${lastFailure} Choose Pay now to try again.`
                : 'Payment was cancelled. Your teas are held for a short while — choose Pay now to finish.',
            )
          },
        },
      })
      // Razorpay keeps the modal open after a failed attempt so the customer can retry.
      checkout.on('payment.failed', (response) => {
        lastFailure = `Payment failed: ${response.error?.description ?? 'the payment was declined'}.`
        setPaymentNotice(lastFailure)
      })
      checkout.open()
    } catch (err) {
      setPaying(false)
      setPaymentNotice(err instanceof Error ? err.message : 'Checkout could not open.')
    }
  }

  /** The server checks the signature and asks Razorpay before the order counts as paid. */
  const confirmPayment = async (placed: PlaceOrderResult, response: RazorpaySuccess) => {
    try {
      const guestToken = sessionStorage.getItem(`elegant_sip_order_access_${placed.order.number}`)
      const { status } = await api.orders.verifyPayment(placed.order.number, response, guestToken)
      if (status === 'paid') {
        setPlacedOrder({ ...placed, order: { ...placed.order, status: 'paid' } })
        setPaymentNotice(null)
        track('purchase', { order: placed.order.number, value: placed.order.total, items: placed.order.items.length })
      } else {
        setPaymentNotice('Payment received and waiting for your bank to confirm. Your order will update shortly.')
      }
    } catch (err) {
      setPaymentNotice(
        err instanceof ApiClientError
          ? err.message
          : 'We could not confirm the payment yet. If you were charged, your order will update shortly.',
      )
    } finally {
      setPaying(false)
      window.scrollTo(0, 0)
    }
  }

  if (orderNumber) {
    return (
      <OrderConfirmedScreen
        orderNumber={orderNumber}
        order={placedOrder?.order ?? null}
        paymentProvider={placedOrder?.payment.provider}
        paymentNotice={paymentNotice}
        paying={paying}
        onPay={placedOrder ? () => void openPayment(placedOrder) : undefined}
      />
    )
  }

  if (cart.length === 0) {
    return <EmptyCartScreen />
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f9faf7] px-6 pb-24 pt-32 text-[#1b261b] font-sans md:px-12 lg:px-24">
        <div className="mx-auto max-w-xl rounded-2xl border border-[#1b261b]/10 bg-white p-8 shadow-[0_12px_40px_rgba(27,38,27,0.04)] md:p-10">
          <Link to="/cart" className="inline-flex items-center gap-3 rounded-lg border border-[#1b261b]/20 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-[#1b261b] transition-colors hover:border-[#4a7333] hover:bg-[#8bb56e]/10"><span aria-hidden="true" className="text-xl leading-none">←</span> Back to cart</Link>
          <h1 className="mt-8 text-4xl font-bold uppercase tracking-tight">Sign in to checkout</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#4a584a]">Sign in or create an account to use your delivery and billing address book securely.</p>
          <button onClick={openLogin} className="mt-7 w-full rounded-lg bg-[#1b261b] px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#4a7333] active:translate-y-px">Sign in or create account</button>
        </div>
      </div>
    )
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
            <Link to="/cart" className="inline-flex items-center gap-3 rounded-lg bg-[#1b261b] px-4 py-3 text-xs font-bold tracking-widest uppercase text-white shadow-[0_8px_18px_rgba(27,38,27,0.14)] transition-all hover:-translate-y-0.5 hover:bg-[#4a7333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4a7333] active:translate-y-px">
              <span aria-hidden="true" className="text-2xl leading-none">←</span> Back to Cart
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
              <>
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
              <BillingAddressSection
                sameAsShipping={sameAsShipping}
                setSameAsShipping={setSameAsShipping}
                addresses={savedAddresses}
                selectedAddress={selectedBillingAddress ?? null}
                selectAddress={(address) => { setBillingAddressId(address.id); setBillingAddressError(null) }}
                error={billingAddressError}
              />
              </>
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
                  <p><span className="font-bold text-[#1b261b]">Ship to:</span> {form.firstName} {form.lastName}, {form.address}, {form.city}{form.state ? `, ${form.state}` : ''} {form.zip}, {form.country}</p>
                  <p><span className="font-bold text-[#1b261b]">Bill to:</span> {sameAsShipping ? 'Same as shipping address' : `${selectedBillingAddress?.name}, ${selectedBillingAddress?.line1}, ${selectedBillingAddress?.city} ${selectedBillingAddress?.postalCode}`}</p>
                  <p><span className="font-bold text-[#1b261b]">Shipping:</span> {SHIPPING_METHODS.find((m) => m.id === shippingMethod)?.label} ({SHIPPING_METHODS.find((m) => m.id === shippingMethod)?.detail})</p>
                  <p><span className="font-bold text-[#1b261b]">Contact:</span> {form.email} · {form.phone}</p>
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
