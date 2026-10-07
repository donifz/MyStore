# Platform Admin and Moderation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An administrator reviews partner applications and product revisions before public activation while sellers continue to use the existing catalog and POS.

**Architecture:** Add platform-scoped authority, partner application and invitation records, and approved/pending publication snapshots. Keep stock and prices in the existing tables; the public DTO reads approved editorial fields from the snapshot. Administration lives in the existing Nest API and React seller web bundle, while the Next.js partner form submits an application.

**Tech Stack:** NestJS, TypeORM/PostgreSQL migrations, React/Vite, Next.js App Router, Jest/Supertest, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-platform-admin-moderation-design.md`

## Global Constraints

- The administrator role is platform scoped and can only be provisioned by a trusted server command.
- Partner approval creates one hidden shop and a single-use invitation; applicant credentials are set only after approval.
- No automated email/SMS exists in this stage. The administrator manually gives the invitation to the applicant.
- New products require approval before public visibility. An approved old revision remains public while a replacement is reviewed.
- Sale price and available stock remain live values from the existing variant/stock tables.
- An administrative decision and its audit entry are committed in the same database transaction.
- Existing orders and stock movements must survive migrations unchanged.

## Review Focus

- Existing published shops/products at migration: preserve the approved public copy and do not interrupt orders.
- Duplicate applications under concurrent requests: return one pending application, no second shop.
- Two administrators deciding the same revision: only one succeeds and one audit decision is recorded.
- Invite token expiry, reuse, guessing, and logging: all rejected without revealing the token or account state.
- Product editorial edit during an active online reservation: checkout must use the approved public name with live price/stock and never rewrite historical order lines.

---

### Task 1: Platform authority and migration

**Files:**
- Create: `apps/api/src/migrations/1760000000010-Moderation.ts`
- Create: `apps/api/src/platform/platform-admin.service.ts`
- Create: `apps/api/src/platform/admin-session.controller.ts`
- Create: `apps/api/src/scripts/set-platform-admin.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/platform-admin.e2e-spec.ts`

**Interfaces:** `PlatformAdminService.requireAdmin(userId: string): Promise<void>`; `GET /platform/admin/session` requires admin; `AuthService.me()` includes `platformAdmin: boolean`.

- [ ] Add a failing integration test: a shop owner receives 403 from an admin endpoint; a provisioned admin receives 200 even without membership, and `/auth/me` reports the role.
- [ ] Run that test against a dedicated `*_test` PostgreSQL database and confirm the expected failure.
- [ ] Add a `platform_admins(user_id PRIMARY KEY REFERENCES users)` table and the admin service; add a server-only provisioning command with explicit user email argument and operator confirmation.
- [ ] Run the focused test, typecheck, migration up/down on a disposable test DB; commit only the task files.

### Task 2: Partner application lifecycle and invitation

**Files:**
- Create: `apps/api/src/platform/partner-applications.service.ts`
- Create: `apps/api/src/platform/partner-applications.controller.ts`
- Modify: `apps/api/src/migrations/1760000000010-Moderation.ts`
- Modify: `apps/api/src/storefront/storefront.controller.ts` (retire direct registration route)
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/partner-applications.e2e-spec.ts`

**Interfaces:** `POST /partners/applications`, `POST /partners/invitations/activate`, `GET /platform/admin/applications`, `POST /platform/admin/applications/:id/decision`. A decision accepts the expected current status and a reason on rejection.

- [ ] Write failing HTTP tests for normalized duplicate email, owner/anonymous denial, approval creating one hidden shop/invite, rejection reason, repeat/concurrent decisions, token expiry/reuse, and no active user before activation.
- [ ] Verify the focused suite fails for missing routes and state.
- [ ] Add `partner_applications`, `partner_application_events`, and `partner_invitations` with unique pending email and token hash; reject applications for an email already owned by a user, and retire the old direct registration path. Implement transaction and row-lock guarded transitions, invite activation and rate limit.
- [ ] Run focused tests and update existing registration tests to the reviewed application flow; commit only task files.

### Task 3: Buyer-facing application form

**Files:**
- Modify: `apps/storefront/components/PartnerForm.tsx`
- Modify: `apps/storefront/app/partner/page.tsx`
- Create: `apps/storefront/app/partner/activate/page.tsx`
- Test: `apps/web/e2e/storefront.spec.ts`

**Interfaces:** Consume task 2 routes. Application fields: shop name, email, phone, city, address, business category, agreement. Activation takes invite token and a password of at least 12 characters.

- [ ] Write a browser test showing application confirmation without a login prompt, and an invalid/used invite failing without account activation.
- [ ] Run the browser test and observe the missing flow.
- [ ] Implement the form and activation page with no token persisted in Web Storage.
- [ ] Run browser tests and Next build; commit task files.

### Task 4: Publication snapshots and public reads

**Files:**
- Create: `apps/api/src/platform/product-moderation.service.ts`
- Modify: `apps/api/src/migrations/1760000000010-Moderation.ts`
- Modify: `apps/api/src/catalog/variants.service.ts`
- Modify: `apps/api/src/catalog/capture.service.ts`
- Modify: `apps/api/src/storefront/storefront.service.ts`
- Modify: `apps/api/src/orders/orders.service.ts`
- Test: `apps/api/test/product-moderation.e2e-spec.ts`

**Interfaces:** `product_publications` stores approved editorial fields/photo; `product_publication_revisions` stores pending/rejected candidates. Public queries join approved fields and live price/stock. Seller edits update accounting fields and stage editorial changes.

- [ ] Write failing integration tests: existing published card remains visible after migration, new card is hidden, editorial edit leaves old copy public, price/stock update is immediate, rejection retains approved copy, photo route serves approved image, checkout snapshots the approved public name with live price.
- [ ] Verify failures reflect absent snapshots and publication gates.
- [ ] Backfill approved snapshots for existing published cards; stage new/edited editorial fields, read public approved snapshot; create new order lines from approved editorial fields and live price/stock; keep POS/accounting variant values and existing historical order lines unchanged.
- [ ] Run product/storefront/order suites and migration test; commit task files.

### Task 5: Administrative moderation API and audit

**Files:**
- Create: `apps/api/src/platform/product-moderation.controller.ts`
- Create: `apps/api/src/platform/admin-audit.controller.ts`
- Modify: `apps/api/src/platform/product-moderation.service.ts`
- Modify: `apps/api/src/migrations/1760000000010-Moderation.ts`
- Modify: `apps/api/src/app.ts`
- Test: `apps/api/test/product-moderation.e2e-spec.ts`

**Interfaces:** `GET /platform/admin/products`, `GET /platform/admin/products/:id`, `POST /platform/admin/products/:id/decision`, `GET /platform/admin/audit`; decision uses the candidate revision ID and expected status.

- [ ] Add failing HTTP tests for role denial, approve/reject and reason, conflict on a stale revision, no cost in DTO, and a single audit row per decision.
- [ ] Run focused tests to observe failures.
- [ ] Implement conditional row-lock decisions and audit writes in the same transaction; read audit with bounded pagination.
- [ ] Run focused and authorization tests; commit task files.

### Task 6: Administrator UI, seller status, and full verification

**Files:**
- Create: `apps/web/src/platform/AdminPage.tsx`
- Create: `apps/web/src/platform/ApplicationReviewPage.tsx`
- Create: `apps/web/src/platform/ProductReviewPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/auth/SessionProvider.tsx`
- Modify: `apps/web/src/catalog/EditVariantPage.tsx`
- Modify: `apps/api/src/app.ts` (SPA fallback for `/platform/admin`)
- Modify: `docs/seller-guide.md`, `docs/storefront-guide.md`
- Test: `apps/web/e2e/moderation.spec.ts`

**Interfaces:** Admin sees queues, details, decisions and audit; seller sees pending/rejected/approved public status and the rejection reason for own card.

- [ ] Write browser tests for admin decisions, partner invite activation, seller visibility, non-admin denial, and old public content during review.
- [ ] Run the tests and observe missing UI/route behavior.
- [ ] Implement route protection, screens, seller status and docs with the existing API client and responsive layout.
- [ ] Run focused browser tests, `npm run typecheck`, `npm run build`, `npm test`, full browser suite, and the production Docker smoke; commit only task files.

## Release

- [ ] Review the migration's effect on current published catalog and orders in a staging database; capture counts before and after.
- [ ] Open implementation PR, wait for CI, merge only after green checks, then verify the Render deploy and application flow.
- [ ] Record equipment and later stages separately: inventory/count/writeoff, analytics/audit/ops, fiscal KKM provider integration.
