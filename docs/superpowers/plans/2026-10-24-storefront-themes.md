# Seasonal Storefront Themes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a storefront owner schedule one safe, editable seasonal presentation without affecting catalogue, prices, stock, cart, or other shops.

**Architecture:** Theme identity and layout stay in a server-known TypeScript registry; each shop stores only a validated theme id, absolute schedule timestamps, and structured banner data. Public storefront DTOs expose only the active presentation. Shared catalog/product components receive resolved presentation tokens rather than copies per theme.

**Tech Stack:** NestJS, TypeORM/PostgreSQL migrations, React, Next.js App Router, Vitest, Jest/Supertest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-merchant-intake-slugs-themes-design.md`

## Global Constraints

- Supported theme ids are exactly `base`, `new-year`, `womens-day`, and `nooruz`.
- Store structured text/image/link fields only; never store user HTML, JavaScript, or CSS.
- A non-base theme renders only inside its shop timezone schedule; invalid ranges do not partially save.
- Public API returns only active, published presentation and no cost/audit/draft data.
- Empty content blocks render nothing and media failures never suppress the catalog or purchase flow.

## Review Focus

- A schedule boundary in a non-Bishkek timezone must choose base/seasonal exactly at the stored instant — Task 1 test.
- A timezone change must not rewrite stored start/end instants — Task 1 test.
- A malformed data URL, oversized image, or disallowed external URL must reject atomically — Task 2 test.
- A theme draft for one shop must never appear through another shop public endpoint — Task 2 test.
- Cart, favourite and buy interactions must remain functional under every theme at 390/768/1440px — Task 3 Playwright test.

---

### Task 1: Theme model, registry, and public resolution

**Files:**
- Create: `apps/api/src/migrations/1760000000026-StorefrontThemes.ts`
- Create: `apps/api/src/storefront/themes.ts`
- Modify: `apps/api/src/storefront/storefront.service.ts`
- Modify: `apps/api/src/storefront/storefront.controller.ts`
- Test: `apps/api/test/storefront.e2e-spec.ts`

**Interfaces:**
- Produces `ThemeId`, `StorefrontThemeInput`, `resolveActiveTheme(settings, now)` and public `presentation` DTO.
- Consumes `shops.time_zone`, settings authorization, and current published-store checks.

- [ ] **Step 1: Write failing API time/scope tests**

Cover all four ids, immediate activation, before/at/after schedule boundaries, invalid range, timezone persistence, unpublished store 404, and cross-shop isolation.

- [ ] **Step 2: Run the focused API test to verify failure**

Run: `npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: FAIL because theme settings and public presentation do not exist.

- [ ] **Step 3: Create validated settings and resolver**

Add a reversible migration for theme id, content JSON, and nullable absolute start/end timestamps. Define a closed registry with tokens/decorative config. Validate ids/range in `StorefrontService`, store instants without shifting them when `timeZone` changes, and add audited owner-only updates. Public `store` and `product` responses call `resolveActiveTheme` and return `base` outside the interval.

- [ ] **Step 4: Run focused API tests**

Run: `npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/migrations/1760000000026-StorefrontThemes.ts apps/api/src/storefront apps/api/test/storefront.e2e-spec.ts
git commit -m "feat: add scheduled storefront themes"
```

### Task 2: Owner editor, image validation, and preview

**Files:**
- Create: `apps/web/src/storefront/ThemeEditor.tsx`
- Create: `apps/web/src/storefront/theme-preview.tsx`
- Modify: `apps/web/src/storefront/types.ts`
- Modify: `apps/web/src/storefront/StorefrontSettingsPage.tsx`
- Modify: `apps/api/src/catalog/product-photo.ts` or create a focused storefront-media normalizer
- Test: `apps/web/src/storefront/StorefrontSettingsPage.test.tsx`
- Test: `apps/api/test/storefront.e2e-spec.ts`

**Interfaces:**
- Consumes `StoreProfile.presentation` / `StorefrontThemeInput` from Task 1.
- Produces labelled editable banners, preview from unsaved form state, and normalized safe image fields.

- [ ] **Step 1: Write failing validation/UI tests**

Test theme selection, immediate/scheduled modes, start-before-end error, cleared blocks omitted from preview, save failure preserving fields, and unsafe link/image rejection.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm --workspace @mystore/web test -- src/storefront/StorefrontSettingsPage.test.tsx && npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: FAIL because no theme controls or validation exist.

- [ ] **Step 3: Implement structured theme editor**

Reuse/extract product-image byte/type/metadata normalization with a storefront-specific size limit. Add owner-only controls for two known banner blocks (image, alt, title, copy, safe link/button), local timezone-aware date-time entry converted to absolute instants, theme cards for four ids, and a non-persistent preview. Keep incomplete blocks out of preview and request body.

- [ ] **Step 4: Run focused tests**

Run: `npm --workspace @mystore/web test -- src/storefront/StorefrontSettingsPage.test.tsx && npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/storefront apps/api/src/catalog
git commit -m "feat: add storefront theme editor"
```

### Task 3: Public themed presentation and regression checks

**Files:**
- Create: `apps/storefront/components/storefront/ThemePresentation.tsx`
- Create: `apps/storefront/components/storefront/theme-registry.ts`
- Modify: `apps/storefront/components/Catalog.tsx`
- Modify: `apps/storefront/app/shop/[slug]/page.tsx`
- Modify: `apps/storefront/app/shop/[slug]/products/[id]/page.tsx`
- Modify: `apps/storefront/lib/public-api.ts`
- Modify: `apps/storefront/styles/tokens.css`
- Modify: `docs/ui-kit.md`
- Test: `apps/storefront/e2e/storefront.spec.ts`

**Interfaces:**
- Consumes public `Store.presentation` from Task 1.
- Produces a single reusable themed shell for catalog and product detail pages; `base` has no optional banners.

- [ ] **Step 1: Write failing SSR/Playwright scenarios**

Verify four registry ids render their intended semantic banner copy, blank/missing media keeps catalog visible, canonical product view uses the same theme, and buy/cart/favourite flows remain intact at 390, 768, and 1440px.

- [ ] **Step 2: Run storefront tests to verify failure**

Run: `npm --workspace @mystore/storefront test && npm --workspace @mystore/storefront exec playwright test e2e/storefront.spec.ts`
Expected: FAIL because public DTOs and presentation shell lack themes.

- [ ] **Step 3: Render themes through shared components**

Add registry-driven CSS tokens and decorative markup to one `ThemePresentation`, nest the existing shared catalogue/product views inside it, omit unset blocks, and use safe link handling. Do not change cart state shape, catalogue data fetches, money formatting, or stock display.

- [ ] **Step 4: Run full quality gates**

Run: `npx prettier --write apps/api/src/storefront apps/web/src/storefront apps/storefront && npm run format:check && npm run typecheck && npm run build && npm test && npm --workspace @mystore/storefront exec playwright test e2e/storefront.spec.ts`
Expected: all checks PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront docs/ui-kit.md
git commit -m "feat: render seasonal storefront themes"
```
