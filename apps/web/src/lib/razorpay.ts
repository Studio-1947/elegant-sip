/* Razorpay Checkout loader, shared by the checkout page and the order page. */

export type RazorpaySuccess = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }
export type RazorpayFailure = { error?: { description?: string } }
export type RazorpayInstance = {
  open: () => void
  on: (event: 'payment.failed', handler: (response: RazorpayFailure) => void) => void
}
export type RazorpayConstructor = new (options: {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name?: string; email?: string; contact?: string }
  theme: { color: string }
  handler: (response: RazorpaySuccess) => void
  modal: { ondismiss: () => void }
}) => RazorpayInstance

export function loadRazorpay(): Promise<RazorpayConstructor> {
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
