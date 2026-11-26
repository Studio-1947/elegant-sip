import { describe, expect, it } from 'vitest'
import { addressLine, INDIAN_STATES, splitAddressLine } from './checkoutData'

describe('address line with a landmark', () => {
  it('adds the landmark after the street address, for the courier', () => {
    expect(addressLine(' 12 Mall Road ', ' Near the clock tower ')).toBe('12 Mall Road, Landmark: Near the clock tower')
    expect(addressLine('12 Mall Road', '  ')).toBe('12 Mall Road')
  })

  it('splits a saved address back into its two fields', () => {
    expect(splitAddressLine('12 Mall Road, Landmark: Near the clock tower')).toEqual({ address: '12 Mall Road', landmark: 'Near the clock tower' })
    expect(splitAddressLine('12 Mall Road')).toEqual({ address: '12 Mall Road', landmark: '' })
  })

  it('suggests all 36 states and union territories', () => {
    expect(INDIAN_STATES).toHaveLength(36)
    expect(INDIAN_STATES).toContain('West Bengal')
  })
})
