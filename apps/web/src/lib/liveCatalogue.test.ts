import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Product } from '@elegantsip/shared'

const products = vi.fn<() => Promise<{ products: Product[] }>>()
vi.mock('./api', () => ({ api: { catalogue: { products: () => products() } } }))

const { PRODUCTS, getProduct } = await import('../data/products')
const { refreshCatalogue, useCatalogue } = await import('./liveCatalogue')

const RETIRED = ['first-flush-whole-leaf', 'first-flush-broken-leaf', 'first-flush-broken-mixed', 'first-flush-fannings']

/** A deep copy of the snapshot as the API would send it now. */
const liveCopy = (): Product[] => structuredClone(PRODUCTS)

describe('live catalogue', () => {
  it('starts from the snapshot without the retired grades', () => {
    expect(PRODUCTS.length).toBeGreaterThan(0)
    for (const slug of RETIRED) expect(getProduct(slug)).toBeUndefined()
  })

  it('overlays live prices, stock and status, drops retired teas and re-renders subscribers', async () => {
    const [first, second, ...rest] = liveCopy()
    const before = PRODUCTS.length
    const keptObject = getProduct(first.slug)
    first.variants[0] = { ...first.variants[0], price: 12_300, compareAtPrice: null, stock: 3 }
    first.fromPrice = 12_300
    first.name = 'A renamed tea'
    second.archivedAt = '2026-11-10T09:00:00.000Z'
    products.mockResolvedValue({ products: [first, second, ...rest] })

    const { result } = renderHook(() => useCatalogue())
    const initial = result.current
    await act(() => refreshCatalogue(true))

    const updated = getProduct(first.slug)!
    // Same object, so anything holding it sees the new figures.
    expect(updated).toBe(keptObject)
    expect(updated.variants[0]).toMatchObject({ price: 12_300, compareAtPrice: null, stock: 3 })
    expect(updated.fromPrice).toBe(12_300)
    // Copy is not overlaid: only the fields staff change day to day.
    expect(updated.name).not.toBe('A renamed tea')

    expect(getProduct(second.slug)).toBeUndefined()
    expect(PRODUCTS).toHaveLength(before - 1)
    expect(result.current).not.toBe(initial)
    expect(result.current.map((p) => p.slug)).toEqual(PRODUCTS.map((p) => p.slug))
  })

  it('brings back a snapshot tea the live list has restored, and keeps the snapshot when the API fails', async () => {
    const restored = structuredClone((await import('../data/catalogue.json')).default.products.find((p) => p.slug === RETIRED[0])) as Product
    restored.archivedAt = null
    products.mockResolvedValue({ products: [...liveCopy(), restored] })
    await refreshCatalogue(true)
    expect(getProduct(RETIRED[0])?.name).toBe(restored.name)

    const shown = PRODUCTS.map((p) => p.slug)
    products.mockRejectedValue(new Error('offline'))
    await refreshCatalogue(true)
    products.mockResolvedValue({ products: [] })
    await refreshCatalogue(true)
    expect(PRODUCTS.map((p) => p.slug)).toEqual(shown)
  })
})
