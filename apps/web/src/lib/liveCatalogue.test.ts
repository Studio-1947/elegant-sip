import { describe, expect, it } from 'vitest'
import type { Product } from '@elegantsip/shared'
import { applyLiveCatalogue } from './liveCatalogue'

const product = (slug: string, price: number, compareAtPrice: number | null, stock: number, listed = true): Product =>
  ({
    slug,
    listed,
    fromPrice: price,
    variants: [{ id: `${slug}-100`, size: '100 g', sku: `${slug}-S100`, price, compareAtPrice, stock }],
  }) as Product

describe('applyLiveCatalogue', () => {
  it('copies price, regular price and stock from the live catalogue', () => {
    const snapshot = [product('green-tea', 58500, 78100, 20)]
    const changed = applyLiveCatalogue([product('green-tea', 55500, 77700, 3)], snapshot)
    expect(changed).toBe(true)
    expect(snapshot[0].variants[0]).toMatchObject({ price: 55500, compareAtPrice: 77700, stock: 3 })
    expect(snapshot[0].fromPrice).toBe(55500)
  })

  it('reports no change when the snapshot is already current', () => {
    const snapshot = [product('green-tea', 58500, 78100, 20)]
    expect(applyLiveCatalogue([product('green-tea', 58500, 78100, 20)], snapshot)).toBe(false)
  })

  it('hides and shows products in the visible list, keeping catalogue order', () => {
    const all = [product('a', 100, null, 1), product('b', 100, null, 1, false), product('c', 100, null, 1)]
    const visible = all.filter((p) => p.listed)
    applyLiveCatalogue(
      [product('a', 100, null, 1, false), product('b', 100, null, 1, true), product('c', 100, null, 1)],
      all,
      visible,
    )
    expect(visible.map((p) => p.slug)).toEqual(['b', 'c'])
  })

  it('leaves products and packs the API did not return untouched', () => {
    const snapshot = [product('white-tea', 132000, 176000, 20)]
    applyLiveCatalogue([product('green-tea', 1, null, 0)], snapshot)
    expect(snapshot[0].variants[0].price).toBe(132000)
  })
})
