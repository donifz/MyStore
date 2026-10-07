# Online orders

Build the next MyStore stage in the existing repository and single Render service. Public Next storefront shoppers can order without an account. Seller Vite UI processes orders. PostgreSQL remains the source of truth for prices, stock and payments.

## Checkout

One shop per cart; adding another shop requires an explicit replacement choice. Persist only cart product references and the pending checkout key, never contact information. Form asks name, phone, pickup/delivery, delivery address and optional comment. Payment is on receipt; the displayed total covers products, with delivery cost agreed with the shop. Server validates published shop/products, quantities (1..1000000), expected current prices, duplicate variants, safe money and stock. Max 100 lines. Phone contains 7..15 digits; name 1..120, address <=250, comment <=500 characters. Delivery requires an address.

Use a random UUID checkout key, server SHA256 fingerprint and a separate public receipt table. Retries with identical payload return the same minimal receipt; changed payload conflicts. A POST receipt lookup by opaque key allows reload/lost-response recovery without putting personal data or tokens in URLs. Public responses contain no customer contact, cost, tenant IDs, or sales document IDs. Origin validation and bounded IP rate limiting protect public writes; new orders are limited to three active unconfirmed orders per normalized phone/shop.

## Stock and lifecycle

New orders reserve all lines atomically using existing sorted stock row locks. Available = physical - reserved everywhere, including POS. Store name, barcode and agreed unit prices as immutable order-line snapshots. New orders expire after 30 minutes; release once on expiry, with a 60 second in-process sweep and checkout/receipt catch-up. Expiry happens before HTTP listen on restart. Confirmed/ready orders hold until issued/cancelled. Transitions: new -> confirmed -> ready -> issued; new/confirmed/ready -> cancelled; new -> expired. Reject other transitions.

Owner/manager can confirm, prepare, cancel; members can read; cashier can issue ready orders using their own open shift and cash/card payment. Issuing releases this order's reservation and posts a sale at the agreed price, payment and order transition in one transaction. Repeated issuing returns the same sale without duplicate stock/payment, including concurrent requests. Existing POS price checks remain intact. Cancellation/expiry never changes physical/value or creates financial documents. Tenant guards protect all seller endpoints and contact fields. Lock order: order row, open shift, variants/stocks (sorted); each expiry transaction handles one order.

## Verification and delivery

Real PostgreSQL API tests prove checkout idempotency, competing checkout/POS stock, rollback, publication/price changes, privacy, tenant isolation, permissions, expiry, cancellation and exactly-once issuing/return compatibility. Browser test proves shopper cart -> checkout -> seller handling -> stock/payment and another-shop replacement. Keep existing no-JS catalog SSR, CSP and seller flows green. Run format, typecheck, build, API/web tests, SSR and CI browser checks; independent branch review, merge and automatic Render deploy. Production checks are read-only; create no production demo records. Online payment gateway, photo storage, domains and printer integration remain later stages.
