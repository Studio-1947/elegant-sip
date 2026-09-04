# Elegant Sip — e-commerce launch checklist

This is the implementation order for moving from a storefront to a safe,
operable online shop. Items are checked only when implemented and verified.

## 1. Payment and order safety

- [x] Require Razorpay, SMTP, and payment secrets for production startup.
- [x] Launch Razorpay Checkout in the storefront; accept payment only through a signed webhook.
- [x] Protect guest-order access with a high-entropy opaque token.
- [x] Expire abandoned pending-payment orders and restore their stock exactly once.
- [x] Prevent a late webhook from reviving an expired order.
- [x] Make order creation idempotent to prevent duplicate orders on retry or double-click.
- [ ] Reconcile local payment state with the gateway on a schedule and alert on mismatches.
- [x] Add a payment-pending status refresh after the hosted checkout closes.
- [ ] Test payment success, failure, delayed webhook, duplicate webhook, and amount mismatch in gateway test mode.

## 2. Fulfilment operations

- [x] Build a staff-only order-operations dashboard; do not use Swagger as the daily operations UI.
- [x] Add customer timeline, print-to-PDF invoice, and fulfilment views.
- [ ] Add staff roles and MFA: fulfilment, catalogue, finance, and super-admin.
- [x] Document the manual tracking workflow (courier integration remains optional).
- [ ] Send shipment and delivery-status notifications.
- [ ] Add low-stock alerts and a stock-movement audit view.

## 3. Cancellations, returns, and refunds

- [x] Let signed-in customers request cancellation/return with a reason.
- [x] Add staff approval and return-received API workflows.
- [ ] Initiate, record, and reconcile full and partial refunds with the payment gateway.
- [x] Restock only accepted, received returned goods, with a ledger record.

## 4. Customer self-service

- [ ] Provide durable guest-order links or account conversion after checkout.
- [x] Add saved addresses and repeat purchase.
- [ ] Add invoice download and a customer-visible order timeline.
- [ ] Add support ticket/reference handling.

## 5. Reliability and security operations

- [ ] Move email, expiry, reconciliation, and notification work to durable background jobs.
- [ ] Add retry/dead-letter handling for email and external-provider failures.
- [ ] Encrypt off-server backups and run documented restore drills.
- [ ] Add uptime, error, payment-webhook, and low-stock alerts.
- [ ] Add dependency scanning and test/build/OpenAPI checks in CI.
- [ ] Add a staging environment with separate database and Razorpay test credentials.
- [ ] Record every admin action in an immutable audit log.

## 6. Launch readiness

- [ ] Confirm GST, invoice, labelling, returns, privacy, and consumer-policy requirements with qualified local advisers.
- [ ] Verify domain, HTTPS, firewall, secret rotation, DNS, email SPF/DKIM, and backup restore.
- [ ] Run a full staging purchase through refund and fulfilment.
- [ ] Write on-call, support, order-exception, and incident-response runbooks.
