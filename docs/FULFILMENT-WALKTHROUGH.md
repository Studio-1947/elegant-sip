# Elegant Sip fulfilment walkthrough

This is the manual operating path until a courier aggregator is connected. It
uses the staff-only `/admin` dashboard; the API independently checks the
administrator role for every action.

## Before opening the shop

1. Set the production payment, SMTP, GST, and database secrets in the VPS
   `.env`; never commit them.
2. Add the Razorpay webhook for `https://elegantsip.in/api/v1/webhooks/razorpay`.
3. Run a test-mode purchase and confirm the order moves from `pending_payment`
   to `paid` only after the signed webhook arrives.
4. Ensure the staff account used for operations has the `admin` role.

## Daily order flow

1. Sign in as staff and open `/admin`.
2. Filter for **Paid** orders. Open **Details** and print the packing slip.
3. Pick the listed packs and verify product, pack size, quantity, and shipping
   address. Use **Mark packed** only after that check.
4. Create a shipment in the chosen courier portal. Enter the courier name and
   tracking number in **Add tracking & ship**. This sends the shipment email
   only when tracking is present.
5. When the courier confirms delivery, use **Mark delivered**.

## Customer experience

- The customer order page refreshes while payment confirmation is pending.
- Its timeline shows payment, packing, shipment, tracking, and delivery state.
- Once an invoice has been issued after payment, **Invoice / Print PDF** opens
  a print-friendly invoice. The browser print dialog can save it as PDF.
- Signed-in customers can submit a cancellation or return reason from an
  eligible order page.

## Returns and cancellations

1. Open the **Returns & cancellations** section in `/admin`.
2. Read the customer reason and **Approve** or **Reject** the request.
3. For a physical return, inspect the received goods and use **Mark received**.
   This is the only action that restores stock, and it writes a ledger record.
4. For a cancellation, do not mark stock or money as refunded manually. A
   gateway refund and reconciliation must be completed first when Razorpay
   credentials and refund handling are enabled.

## Exceptions

- A payment that is pending for the configured timeout is cancelled and stock
  is returned automatically; a late payment webhook cannot revive it.
- Do not use Swagger for routine fulfilment. It is an engineering interface,
  not an operational console.
- Escalate any amount mismatch, missing tracking, duplicate request, or failed
  email to the shop owner and retain the order number for investigation.
