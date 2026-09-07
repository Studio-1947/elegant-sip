# PIN-code checkout lookup

## Goal

Suggest real India Post localities when a customer enters a six-digit PIN, and
fill the checkout city, state, and country from the selection.

## Plan

- [x] Keep the postal-data provider behind a rate-limited, cached API route.
- [x] Add accessible checkout suggestions and automatic location fill.
- [x] Regenerate the API contract and verify the change.

## Boundaries

- A PIN identifies a postal locality, not a delivery street address, so street
  address remains customer-entered.
- Lookup is optional: a provider outage must not prevent checkout.
