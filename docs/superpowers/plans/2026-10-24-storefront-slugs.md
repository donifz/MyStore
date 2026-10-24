# Canonical Storefront Slugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every public store one permanent `/shop/:slug` address while safely redirecting former addresses.

**Architecture:** A new `shop_slugs` history table is the authoritative globally unique namespace. `StorefrontService` resolves a current or historical slug and returns the current canonical slug; the Next storefront makes 308 redirects before rendering. The settings endpoint performs owner-only slug changes transactionally and audits success and conflict attempts.

**Tech Stack:** NestJS, TypeORM/PostgreSQL migrations, Next.js App Router, React, Playwright, Jest/Supertest.

**Spec:** `docs/superpowers/specs/2026-10-21-merchant-intake-slugs-themes-design.md`

## Global Constraints

- Slugs are lowercase ASCII `a-z`, digits, and internal hyphens, 3–40 chars.
- Current and former slugs remain globally unique forever; reserved names are unavailable.
- Only an owner may change a slug; authorization is server-enforced.
- Legacy `/shops/...` routes permanently redirect to `/shop/...`.
- Hidden or blocked shops remain 404 through current and historical aliases.

## Review Focus

- Case-only simultaneous slug claims must resolve to one winner in PostgreSQL — Task 1 test.
- A failed conflicting rename must leave current slug and history intact but write audit evidence — Task 2 test.
- A historical product URL must preserve product id/query intent on a 308 redirect — Task 3 SSR test.
- Sitemap and canonical tags must never publish the legacy `/shops` address — Task 3 test.
- Checkout/favourite/cart links must use canonical URLs without altering their stored payloads — Task 3 Playwright test.

---

### Task 1: Slug namespace migration and resolver

**Files:**
- Create: `apps/api/src/migrations/1760000000025-StorefrontSlugs.ts`
- Modify: `apps/api/src/storefront/storefront.service.ts`
- Test: `apps/api/test/storefront.e2e-spec.ts`

**Interfaces:**
- Produces `resolvePublicSlug(input: string): Promise<{ shopId: string; canonicalSlug: string; historical: boolean }>` and owner-only `updateSlug(shopId, slug, actor)`.
- Consumes `shops.slug` current slug and `audit_log`.

- [ ] **Step 1: Write failing migration/API tests**

Exercise lowercase normalization, invalid/reserved values, case-insensitive conflict, old slug reservation, current and historical resolution, and inaccessible unpublished/blocklisted stores.

- [ ] **Step 2: Run focused API tests to verify failure**

Run: `npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: FAIL because history/resolution and slug mutation do not exist.

- [ ] **Step 3: Add permanent slug history**

Create `shop_slugs(slug citext/text-normalized primary key, shop_id uuid, is_current boolean, created_at)` with a partial one-current-row-per-shop index; backfill every existing `shops.slug`. Validate and normalize centrally in `StorefrontService`, atomically replace current slug, never delete old rows, and write `slug_changed` / `slug_change_rejected` audit events.

- [ ] **Step 4: Run migration and API tests**

Run: `npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/migrations/1760000000025-StorefrontSlugs.ts apps/api/src/storefront/storefront.service.ts apps/api/test/storefront.e2e-spec.ts
git commit -m "feat: preserve canonical storefront slugs"
```

### Task 2: Settings DTO and seller address editor

**Files:**
- Modify: `apps/api/src/storefront/storefront.controller.ts`
- Modify: `apps/api/src/storefront/storefront.service.ts`
- Modify: `apps/web/src/storefront/types.ts`
- Modify: `apps/web/src/storefront/StorefrontSettingsPage.tsx`
- Test: `apps/web/src/storefront/StorefrontSettingsPage.test.tsx`
- Test: `apps/api/test/storefront.e2e-spec.ts`

**Interfaces:**
- Consumes `updateSlug` from Task 1.
- Produces `StoreProfile.slug` plus a clear 409 “Адрес занят, выберите другой” response.

- [ ] **Step 1: Write failing owner/UI tests**

Test a seller sees `/shop/<slug>` preview, successfully saves a valid normalized address, retains entered value on 409, and manager/cashier receive 403 for a direct slug update.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `npm --workspace @mystore/web test -- src/storefront/StorefrontSettingsPage.test.tsx && npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: FAIL because the DTO and UI do not expose slug editing.

- [ ] **Step 3: Add owner-only address editing**

Add optional validated `slug` to the settings PUT DTO. In the existing profile transaction call the slug resolver/mutator before returning the new profile. Add labelled input, availability/format hint, canonical preview, and non-destructive API error handling in the settings page.

- [ ] **Step 4: Run focused tests**

Run: `npm --workspace @mystore/web test -- src/storefront/StorefrontSettingsPage.test.tsx && npm --workspace @mystore/api test -- storefront.e2e-spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/storefront apps/web/src/storefront
git commit -m "feat: let owners manage storefront addresses"
```

### Task 3: Canonical public API, Next routes, and links

**Files:**
- Modify: `apps/api/src/storefront/storefront.service.ts`
- Modify: `apps/api/src/storefront/storefront.controller.ts`
- Create: `apps/storefront/app/shop/[slug]/page.tsx`
- Create: `apps/storefront/app/shop/[slug]/products/[id]/page.tsx`
- Modify: `apps/storefront/app/shops/[slug]/page.tsx`
- Modify: `apps/storefront/app/shops/[slug]/products/[id]/page.tsx`
- Modify: `apps/storefront/app/sitemap.ts`
- Modify: `apps/storefront/lib/seo.ts`
- Modify: `apps/storefront/components/**/*.tsx`
- Test: `apps/storefront/e2e/storefront.spec.ts`

**Interfaces:**
- Consumes public API responses with `canonicalSlug` and alias status.
- Produces 308 redirects and canonical `/shop/:slug` links across SSR, metadata, sitemap, cart, checkout, favourites, and product navigation.

- [ ] **Step 1: Write failing SSR/Playwright coverage**

Add cases for `/shops/:slug` and a historical `/shop/:old` producing 308 to current canonical addresses, public product metadata canonical URL, sitemap entries, and page navigation at 390/768/1440 widths.

- [ ] **Step 2: Run storefront tests to verify failure**

Run: `npm --workspace @mystore/storefront test && npm --workspace @mystore/storefront exec playwright test e2e/storefront.spec.ts`
Expected: FAIL because canonical routes and redirects are absent.

- [ ] **Step 3: Resolve aliases before rendering**

Return canonical slug in public store/product DTOs; add canonical route pages, redirect legacy route handlers with `permanentRedirect`, and redirect an alias from the API-derived canonical value before catalogue/product rendering. Replace generated public links and SEO/sitemap paths with `/shop` while retaining `/shops` only as redirect compatibility routes.

- [ ] **Step 4: Run storefront gates**

Run: `npm --workspace @mystore/storefront test && npm --workspace @mystore/storefront run build && npm --workspace @mystore/storefront exec playwright test e2e/storefront.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/storefront apps/storefront
git commit -m "feat: publish storefronts at canonical shop urls"
```
