import { describe, expect, it } from 'vitest'
import { locationsFromPostalResponse } from './pincode.js'

describe('locationsFromPostalResponse', () => {
  it('keeps valid India Post localities and removes duplicate offices', () => {
    const locations = locationsFromPostalResponse([
      {
        Status: 'Success',
        PostOffice: [
          { Name: 'Darjeeling H.O.', District: 'Darjeeling', State: 'West Bengal', Country: 'India', DeliveryStatus: 'Delivery' },
          { Name: 'Darjeeling H.O.', District: 'Darjeeling', State: 'West Bengal', Country: 'India', DeliveryStatus: 'Delivery' },
          { Name: 'Foreign Office', District: 'Elsewhere', State: 'Elsewhere', Country: 'Other' },
        ],
      },
    ])

    expect(locations).toEqual([
      { officeName: 'Darjeeling H.O.', city: 'Darjeeling', district: 'Darjeeling', state: 'West Bengal', country: 'India', deliveryStatus: 'Delivery' },
    ])
  })

  it('returns no locations when the provider has no matching PIN', () => {
    expect(locationsFromPostalResponse([{ Status: 'Error', PostOffice: null }])).toEqual([])
  })
})
