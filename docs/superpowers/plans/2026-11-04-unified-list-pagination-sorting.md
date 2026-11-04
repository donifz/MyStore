# Unified List Pagination and Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use consistent numbered, accessible pagination across MyStore lists, with the newest product first and useful server-side sorting/filters.

**Architecture:** Reuse one React pagination component instead of duplicating button logic. Apply the sort/filter in PostgreSQL before LIMIT/OFFSET for paginated API endpoints; preserve existing shop authorization and count queries.

**Tech Stack:** React 19, TypeScript, NestJS, PostgreSQL, Vitest.

**Spec:** User request of November 4, 2026: more than five pages use an ellipsis and an end-page control; latest-added products appear first; lists expose practical sorting and filtering.

## Global Constraints

- Do not change stock/payments or database records.
- Keep the existing design tokens, admin UI conventions, and responsive layout.
- Existing catalog search, archived, stock filter, label selection, and platform moderation must continue working.
- Reset to page 1 on any sort or filter change; server pagination must sort **before** the page slice.
- Bound and validate all query sort values.

## Review Focus

- Page 1 of 20: show 1–5, ellipsis, and 20.
- Middle and last page: show first/last and the current page without invalid buttons.
- Search/filter returning fewer pages: never strand the user on a nonexistent page.
- Ties in created_at or prices: use a stable id tie-breaker.
- Other API consumers relying on default alphabetical variant ordering: preserve compatibility by explicitly requesting newest in the seller catalog.

---

### Task 1: Shared pagination
**Files:** `apps/web/src/components/Pagination.tsx`, `apps/web/src/components/Pagination.test.tsx`, `apps/web/src/styles.css`
- [ ] Write tests for first/middle/end windows and page click accessibility.
- [ ] Verify failure before implementation.
- [ ] Implement a 5-page window with first/last, ellipses, previous/next, and jump-to-end.
- [ ] Run focused tests and format checks.
- [ ] Commit.

### Task 2: Product listings
**Files:** `apps/api/src/catalog/variants.controller.ts`, `apps/api/src/catalog/variants.service.ts`, `apps/web/src/catalog/CatalogPage.tsx`, `apps/web/src/catalog/BarcodeLabelsPage.tsx`
- [ ] Write tests for newest-first and filter/sort requests.
- [ ] Verify failure.
- [ ] Whitelist sort values and order on the server before paging.
- [ ] Add UI sort controls, retain search/stock filtering and select-all printing behavior.
- [ ] Run tests and commit.

### Task 3: Sales, orders, public lists, and platform lists
**Files:** `apps/web/src/pos/SalesHistoryPage.tsx`, `apps/web/src/orders/OrdersPage.tsx`, `apps/web/src/storefront/CatalogPublicPage.tsx`, `apps/web/src/storefront/StoresPage.tsx`, `apps/web/src/platform/AdminPage.tsx`, corresponding API endpoints.
- [ ] Add tests for list request parameters and pagination.
- [ ] Verify failure.
- [ ] Apply shared navigation and practical sorting/filter controls with safe SQL ordering.
- [ ] Run relevant test suites and commit.

### Task 4: Verify and ship
- [ ] Run `npm run format:check`, `npm run typecheck`, `npm run build`, web unit and E2E tests.
- [ ] Review CI checks and address failures before merging.
- [ ] Open a non-draft PR; do not merge with failed checks.
