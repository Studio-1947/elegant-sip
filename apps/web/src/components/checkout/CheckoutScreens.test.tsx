import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { OrderView } from '../../lib/api'
import { OrderConfirmedScreen } from './CheckoutScreens'

const order = (status: OrderView['status']) => ({ number: 'ES-1', status, total: 631_400 }) as OrderView

const heading = () => screen.getByRole('heading', { level: 1 }).textContent
const payButton = () => screen.queryByRole('button', { name: /pay now/i })

describe('OrderConfirmedScreen', () => {
  it('asks for payment, not "Order placed", while the order is unpaid', () => {
    render(<OrderConfirmedScreen orderNumber="ES-1" order={order('pending_payment')} paymentProvider="razorpay" onPay={vi.fn()} />)
    expect(heading()).toBe('Complete your payment')
    expect(screen.queryByText(/order placed/i)).toBeNull()
    expect(payButton()).toBeTruthy()
  })

  it('says the payment was not completed after a cancel, and still offers Pay now', () => {
    render(
      <OrderConfirmedScreen
        orderNumber="ES-1"
        order={order('pending_payment')}
        paymentProvider="razorpay"
        paymentNotice="The payment window was closed before payment finished."
        onPay={vi.fn()}
      />,
    )
    expect(heading()).toBe('Payment not completed')
    expect(screen.getByRole('alert').textContent).toContain('closed before payment finished')
    expect(payButton()).toBeTruthy()
  })

  it('never offers a second payment while a successful one is being confirmed', () => {
    render(
      <OrderConfirmedScreen
        orderNumber="ES-1"
        order={order('pending_payment')}
        paymentProvider="razorpay"
        paymentSubmitted
        paymentNotice="Payment received and waiting for your bank to confirm."
        onPay={vi.fn()}
      />,
    )
    expect(heading()).toBe('Confirming your payment')
    expect(payButton()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows "Payment received" only once the order is paid', () => {
    render(<OrderConfirmedScreen orderNumber="ES-1" order={order('paid')} paymentProvider="razorpay" onPay={vi.fn()} />)
    expect(heading()).toBe('Payment received')
    expect(payButton()).toBeNull()
  })
})
