# Online Orders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the public cart to seller orders and shared POS stock.

**Architecture:** Add transactional order services and a migration, reuse stock locks and POS payment posting. Public Next clients keep cart/pending receipt references; seller Vite pages use existing session/CSRF APIs.

**Tech Stack:** NestJS, PostgreSQL 18, React 19, Next 16, Vite, Jest, Vitest, Playwright.

**Spec:** docs/superpowers/specs/2026-10-07-online-orders-design.md

## Global Constraints

- Only MyStore and its existing single Render service; no new paid resources.
- One shop per cart; payment on receipt; product total excludes agreed delivery cost.
- Max 100 lines, quantity 1..1000000, name 1..120, phone 7..15 digits, address <=250, comment <=500.
- New orders expire after 30 minutes; 60 second sweep; startup expiry catch-up.
- Never persist customer contacts in browser storage or expose them through public receipts.
- Existing cashier, publication, SSR and CSP behavior stays compatible.

## Review Focus

- Lost checkout response followed by reload must recover the same order without persisting contacts.
- Competing checkout/POS/expiry requests must never oversell or release another order's stock.
- Price changes after reservation must preserve the agreed order price while ordinary POS checks current price.
- Hiding a shop/product must reject new checkout without preventing processing an existing order.
- Retry after ready-order issuing must not create a second payment, including a different idempotency key.

---

### Task 1: Transactional order backend

**Files:** Create migration 1760000000007-Orders.ts, orders/{orders.service,orders.controller,order-expiration.service}.ts, test/orders.e2e-spec.ts. Modify database.ts, app.ts, main.ts, pos/{sales,pos-sales}.service.ts.

**Interfaces:**
- Consumes StockService.lock(tx,shopId,ids), SalesService.normalize(lines), ShiftsService.lockOpen(tx,shopId,shiftId,actorId).
- Produces POST /public/orders {checkoutKey,storeSlug,name,phone,fulfillment,address,comment,lines}; POST /public/orders/receipt {checkoutKey}; receipt {id,status,totalMinor,expiresAt,storeName} without contacts.
- Produces GET /shops/:shopId/orders (paginated), GET /shops/:shopId/orders/:id (contact/line snapshots), POST /shops/:shopId/orders/:id/status {status:'confirmed'|'ready'|'cancelled'}, POST .../issue {shiftId,method:'cash'|'card'} with Idempotency-Key.
- Produces OrderExpirationService.expire(shop?: string): Promise<void>, draining overdue work in single-order transactions, and expireForCheckout(tx,shop) locking overdue orders before their sorted stock union; PosSalesService.postInTransaction(tx,shopId,actorId,shiftId,method,lines,agreedPrice=false).

- [ ] Write real-DB API tests for creating/retrying/conflicting checkout, receipt privacy, validation, hidden/current-price rejection, all-line rollback, stock competition, cancellation/expiry, tenant/role guards, snapshot-price issuing, concurrent exactly-once issuing and payment/return compatibility.
- [ ] Run `bash /tmp/mystore-order-tests.sh npm run test:e2e --workspace apps/api -- --runInBand orders`; expect missing-route 404 assertions.
- [ ] Implement migration, services/controllers, registration, expiry/startup and trusted internal agreed-price POS transaction path.
- [ ] Run the order tests and whole `npm test` with dedicated PostgreSQL; expect all green.
- [ ] Commit backend. Run task-done with whole test command.

### Task 2: Public cart and checkout

**Files:** Create apps/storefront/components/{CartProvider,BuyButton,Checkout}.tsx and app/cart/page.tsx. Modify layout, product page, CSS and Nest public allowlist; create browser order scenario.

**Interfaces:**
- Consumes Task 1 public order/receipt endpoints and lib/public-api Product.
- Produces CartProvider/useCart, BuyButton({product}), /cart with quantity/removal, checkout form, pending-response recovery and receipt.

- [ ] Write Playwright scenario buyer adds stocked product, replaces shop only explicitly, checks out pickup/delivery, reloads receipt without stored contacts and sees reduced public availability.
- [ ] Run scenario; expect missing add-to-cart control/route.
- [ ] Implement storage validation, pending checkout locking/recovery, safe quantity/money and server conflict messages. Add public route to allowlist and header cart link; keep catalog SSR intact.
- [ ] Run typecheck/build/SSR and browser scenario; expect passing shopper portion.
- [ ] Commit; task-done with build/typecheck/SSR command plus browser evidence.

### Task 3: Seller order handling and release

**Files:** Create apps/web/src/orders/OrdersPage.tsx, modify App.tsx, SellerLayout.tsx, API types, browser scenario and docs/README as needed.

**Interfaces:**
- Consumes Task 1 seller endpoints and currentShift/session/API client.
- Produces Заказы list/detail with contacts, delivery, line snapshots, state actions and ready issuing through own open shift.

- [ ] Extend browser scenario to seller confirm/prepare/issue, verify physical/reserved/payment, refresh and cancel another order; expect missing Заказы link.
- [ ] Implement list/detail, role-aware actions, pending/retry safety and error/reload states.
- [ ] Run format, typecheck, build, full tests, SSR and browser/CI checks; expect all green.
- [ ] Commit; task-done with full verification. Independent branch review, fix important findings with regression tests, upload exact tree, PR, CI, merge, automatic deploy and read-only live verification.
