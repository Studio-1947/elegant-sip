# Address book and billing checkout

## Goal

Require sign-in before checkout, let customers manage reusable shipping and billing addresses, and snapshot the selected billing address on every new order.

## Tasks

- [x] Make the checkout return-to-cart action visually prominent.
- [x] Add safe billing-order and address-role database fields, with backfill migration.
- [x] Extend the account address API for default shipping/billing roles and editing.
- [x] Add the account address book and checkout billing-address controls.
- [x] Require sign-in for checkout and send both address snapshots when ordering.
- [x] Update the API contract and execute migration, tests, lint, typecheck, build, and live route checks.

## Decisions

- Billing is an immutable order and invoice snapshot.
- One saved address can serve both roles and has independent default shipping and billing flags.
- Checkout requires sign-in; guests do not use an address book.
