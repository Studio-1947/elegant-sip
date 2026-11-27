import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ pricing: { quote: vi.fn(), validateCoupon: vi.fn() }, wishlist: { get: vi.fn(), replace: vi.fn() }, carts: { sync: vi.fn() } }))
vi.mock('../lib/api', async (importOriginal) => ({ ...(await importOriginal<typeof import('../lib/api')>()), api }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ user: null }) }))

import { CartProvider, useCart } from './CartContext'

function Lines() {
  const { cart, cartTotal } = useCart()
  return (
    <ul>
      {cart.map((i) => (
        <li key={i.productSlug}>{`${i.name} · ${i.price}`}</li>
      ))}
      <li>{`total ${cartTotal}`}</li>
    </ul>
  )
}

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

const QUOTE = {
  items: [{ productSlug: 'green-tea', productName: 'Emerald Fresh | Green Tea', variantSize: '100 g', imageSrc: '/x.webp', quantity: 1, unitPrice: 39100, lineTotal: 39100 }],
  subtotal: 39100, discount: 0, coupon: null, couponError: null, shippingMethod: 'standard', shippingFee: 3000, tax: 0, total: 42100, amountToFreeShipping: 60900, adjustments: [],
}

function Controls() {
  const { updateQuantity, clearCart } = useCart()
  return (
    <>
      <button onClick={() => updateQuantity('green-tea', '100 g', 2)}>two</button>
      <button onClick={clearCart}>clear</button>
    </>
  )
}

const pause = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

describe('cart lines', () => {
  it('show the server\'s current name and price, not the ones the stored cart started with', async () => {
    // A cart saved earlier, priced from an old catalogue.
    localStorage.setItem('elegant_sip_cart', JSON.stringify([{ productSlug: 'green-tea', name: 'Green Tea', size: '100 g', price: 58500, quantity: 1, imageSrc: '/x.webp' }]))
    api.pricing.quote.mockResolvedValue({
      items: [{ productSlug: 'green-tea', productName: 'Emerald Fresh | Green Tea', variantSize: '100 g', imageSrc: '/x.webp', quantity: 1, unitPrice: 39100, lineTotal: 39100 }],
      subtotal: 39100, discount: 0, coupon: null, couponError: null, shippingMethod: 'standard', shippingFee: 3000, tax: 0, total: 42100, amountToFreeShipping: 60900, adjustments: [],
    })
    render(
      <CartProvider>
        <Lines />
      </CartProvider>,
    )
    // Lines and total agree once the server has priced the cart.
    expect(await screen.findByText('Emerald Fresh | Green Tea · 39100')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('total 39100')).toBeTruthy())
  })
})

describe('saved copy for the staff cart list', () => {
  const start = () => {
    localStorage.setItem('elegant_sip_cart', JSON.stringify([{ productSlug: 'green-tea', name: 'Green Tea', size: '100 g', price: 39100, quantity: 1, imageSrc: '/x.webp' }]))
    api.pricing.quote.mockResolvedValue(QUOTE)
    api.carts.sync.mockResolvedValue(undefined)
    render(
      <CartProvider>
        <Controls />
      </CartProvider>,
    )
  }

  it('is not sent just for loading the page', async () => {
    start()
    await pause(1700)
    expect(api.carts.sync).not.toHaveBeenCalled()
  })

  it('is sent when the cart changes, under one ID, without prices', async () => {
    start()
    fireEvent.click(screen.getByText('two'))
    await waitFor(() => expect(api.carts.sync).toHaveBeenCalledTimes(1), { timeout: 3000 })
    const [id, payload] = api.carts.sync.mock.calls[0]
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStorage.getItem('elegant_sip_cart_id')).toBe(id)
    expect(payload).toEqual({ items: [{ productSlug: 'green-tea', variantSize: '100 g', quantity: 2 }] })
  })

  it('starts a new cart after an order instead of emptying the old one', async () => {
    start()
    fireEvent.click(screen.getByText('two'))
    await waitFor(() => expect(api.carts.sync).toHaveBeenCalledTimes(1), { timeout: 3000 })
    const [first] = api.carts.sync.mock.calls[0]
    fireEvent.click(screen.getByText('clear'))
    await pause(1700)
    expect(api.carts.sync).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('elegant_sip_cart_id')).not.toBe(first)
  })
})
