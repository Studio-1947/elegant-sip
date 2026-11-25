import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const api = vi.hoisted(() => ({ pricing: { quote: vi.fn(), validateCoupon: vi.fn() }, wishlist: { get: vi.fn(), replace: vi.fn() } }))
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

afterEach(() => localStorage.clear())

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
