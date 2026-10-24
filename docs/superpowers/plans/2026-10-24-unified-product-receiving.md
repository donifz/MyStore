# Unified Product Creation and Primary Receiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a seller create a product card and safely post its first receiving document from one recovery-safe workflow.

**Architecture:** Keep product creation and receiving as separate server mutations. `VariantsService` will use the existing operation-results idempotency store; a saved client workflow owns stable derived keys for card and receiving phases. The existing receiving draft continues to own multi-line documents, while the new product form adds a one-product primary-receiving path.

**Tech Stack:** NestJS, TypeORM/PostgreSQL, React, TypeScript, Vitest, Jest/Supertest.

**Spec:** `docs/superpowers/specs/2026-10-21-merchant-intake-slugs-themes-design.md`

## Global Constraints

- Store money only as integer minor units; never change stock when a card is created.
- Require a stable idempotency key for every creation and receipt mutation.
- Only a posted receiving document may change stock and stock value, in one transaction.
- Enforce shop isolation and catalog/receiving permissions on the server.
- Preserve existing receipt drafts and their lines when a scanned product is created or linked.

## Review Focus

- Retrying product creation after a lost response must return the original variant, not a duplicate — Task 1 API test.
- Same creation key with changed input must fail without changing a card — Task 1 API test.
- A card that succeeds but whose receiving fails must remain at zero stock — Task 2 end-to-end test.
- An archived matching barcode must not be received until explicit unarchive — Task 2 API test.
- An unknown result must retain its original workflow keys and block a new posting attempt — Task 3 UI test.

---

### Task 1: Idempotent product-card API

**Files:**
- Modify: `apps/api/src/catalog/variants.controller.ts`
- Modify: `apps/api/src/catalog/variants.service.ts`
- Modify: `apps/api/test/variants-archive-groups.e2e-spec.ts`

**Interfaces:**
- Consumes: `IdempotencyService.execute(shopId, key, payload, work, authorize?)`.
- Produces: `POST /shops/:shopId/variants` requiring `Idempotency-Key` and returning the original `Variant` on an identical retry.

- [ ] **Step 1: Write failing Supertest cases**

Cover missing/invalid key (400), same key/same `VariantDto` returning one variant, and same key/different payload returning 409; assert only one variant and one publication row exist.

- [ ] **Step 2: Run the focused API test to verify it fails**

Run: `npm --workspace @mystore/api test -- variants-archive-groups.e2e-spec.ts`
Expected: FAIL because the create endpoint does not yet read or persist an operation key.

- [ ] **Step 3: Route creation through `IdempotencyService.execute`**

Pass the `idempotency-key` request header from `VariantsController.create` to `VariantsService.createVariant(shopId, input, actor, key)`. Normalize the creation payload before fingerprinting, execute category/parent validation inside the transaction, and re-check catalog authorization for cached retries.

- [ ] **Step 4: Run focused API tests**

Run: `npm --workspace @mystore/api test -- variants-archive-groups.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/catalog/variants.controller.ts apps/api/src/catalog/variants.service.ts apps/api/test/variants-archive-groups.e2e-spec.ts
git commit -m "feat: make product creation idempotent"
```

### Task 2: Saved primary-receiving workflow

**Files:**
- Modify: `apps/web/src/catalog/ProductForm.tsx`
- Modify: `apps/web/src/catalog/CreateVariantPage.tsx`
- Modify: `apps/web/src/receiving/ReceivingProductForm.tsx`
- Modify: `apps/web/src/receiving/ReceivingPage.tsx`
- Modify: `apps/web/src/drafts/draft-store.ts`
- Modify: `apps/web/src/drafts/use-document.ts`
- Test: `apps/web/src/receiving/ReceivingPage.test.tsx`
- Test: `apps/api/test/receiving.e2e-spec.ts`

**Interfaces:**
- Consumes: idempotent `POST /shops/:shopId/variants` and current idempotent `POST /shops/:shopId/receivings`.
- Produces: persisted `PrimaryReceivingWorkflow` with a workflow id, a card key, a receiving key, saved card result, and phase state.

- [ ] **Step 1: Write failing workflow tests**

Add UI cases for a card plus quantity/cost/receipt metadata creating first then receiving with different derived keys; receiving rejection keeps fields and saved card without changing stock; “create without receiving” sends only the card request. Add API coverage that an archived variant rejects receipt with no stock-document/movement change.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm --workspace @mystore/web test -- src/receiving/ReceivingPage.test.tsx && npm --workspace @mystore/api test -- receiving.e2e-spec.ts`
Expected: FAIL because creation currently has no persistent two-phase workflow.

- [ ] **Step 3: Implement `PrimaryReceivingWorkflow` persistence and UI**

Extend the draft schema with a backward-compatible optional workflow. Render one form from both catalogue creation and receiving: product fields, receipt quantity/unit cost/supplier/document/date/comment, primary “Создать и провести приёмку” and secondary “Создать без приёмки”. Derive `product:<workflow-id>` and `receiving:<workflow-id>` keys once, persist before each request, and on retry run only the incomplete phase.

- [ ] **Step 4: Keep barcode linking explicit**

For an unknown scan, preserve existing “create new” and add a search/link action; adding the chosen existing variant must preserve other draft lines. Keep generated server barcode behavior for an empty field and make archived results explain that unarchive is required.

- [ ] **Step 5: Run focused tests**

Run: `npm --workspace @mystore/web test -- src/receiving/ReceivingPage.test.tsx && npm --workspace @mystore/api test -- receiving.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/catalog apps/web/src/receiving apps/web/src/drafts apps/web/src/receiving/ReceivingPage.test.tsx apps/api/test/receiving.e2e-spec.ts
git commit -m "feat: combine product creation with first receiving"
```

### Task 3: Recovery, role boundaries, and full verification

**Files:**
- Modify: `apps/web/src/receiving/ReceivingPage.test.tsx`
- Modify: `apps/web/src/catalog/ProductForm.test.tsx`
- Modify: `apps/api/test/receiving.e2e-spec.ts`

**Interfaces:**
- Consumes: persisted primary-receiving workflow from Task 2.
- Produces: regression coverage for retries, access denial, stock/accounting invariants, and responsive page navigation.

- [ ] **Step 1: Write recovery and permission cases**

Test a saved unknown request blocks new keys; a manager with both permissions succeeds; a cashier cannot create, see unit cost, or post receiving; an existing out-of-stock active variant receives normally and gets the correct weighted stock value.

- [ ] **Step 2: Run focused tests**

Run: `npm --workspace @mystore/web test -- src/receiving/ReceivingPage.test.tsx src/catalog/ProductForm.test.tsx && npm --workspace @mystore/api test -- receiving.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 3: Format and run project gates**

Run: `npx prettier --write apps/api/src/catalog/variants.controller.ts apps/api/src/catalog/variants.service.ts apps/web/src/catalog/ProductForm.tsx apps/web/src/receiving/ReceivingPage.tsx apps/web/src/drafts/use-document.ts && npm run format:check && npm run typecheck && npm run build && npm test`
Expected: all checks PASS.

- [ ] **Step 4: Commit regression coverage**

```bash
git add apps/api/test apps/web/src/receiving/ReceivingPage.test.tsx apps/web/src/catalog/ProductForm.test.tsx
git commit -m "test: cover primary receiving recovery"
```
