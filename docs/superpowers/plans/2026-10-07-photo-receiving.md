# Photo Receiving Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Photograph, describe and receive a new product with generated codes.

**Architecture:** One authenticated idempotent capture endpoint reuses transactional receiving. PostgreSQL stores normalized JPEG; Vite capture page previews and confirms; Next catalog uses public image URL.

**Tech Stack:** Nest, sharp, PostgreSQL, React, existing document drafts, Playwright.

**Spec:** docs/superpowers/specs/2026-10-07-photo-receiving-design.md

## Global Constraints

- Existing MyStore and Render only; no new resources.
- JPEG <=512 KiB, 16 million decoded pixel limit, 1024x1024 output, JSON <=1 MiB.
- Quantity 1..1000000; manual name/purchase/sale prices; no claimed AI recognition.
- Atomic idempotent receiving; cashier cannot capture or read purchase prices.

## Review Focus

- Lost response/reload cannot create duplicate product or receiving.
- Invalid compressed images must be rejected without product/stock.
- Hidden store/product images must return 404 publicly.
- Plain legacy product creation must still work and receive generated article.
- A photo must remain readable after deployment; no ephemeral file storage.

### Task 1: Photo product capture

**Files:** Create migration 1760000000008-ProductPhotos.ts, catalog/capture.{service,controller}.ts, test/capture.e2e-spec.ts, web/catalog/CapturePage.tsx, e2e/capture.spec.ts; modify receiving service, variants service, public photo controller/DTO, app/database, API/web types, draft kind, routes/styles and Next product covers.

**Interfaces:** POST /shops/:shopId/variants/capture with Idempotency-Key, {name,barcode?,unitCostMinor,salePriceMinor,quantity,photoDataUrl,category,description} returns Variant & {receivingId,quantity}; GET /shops/:shopId/variants/:id/photo (private), GET /public/stores/:slug/products/:id/photo (public). ReceivingService.postInTransaction(tx,shop,actor,normalized) reuses stock document writer. Photo stores only normalized bytes; SKU default lives in DB.

- [ ] Write DB tests for valid capture/receiving/codes/retry, malformed JPEG rollback, overflow rollback, permissions, public photo publication and private cost visibility. Run dedicated capture tests, expect route 404.
- [ ] Write browser upload -> preview -> confirm -> code/stock/photo test. Run against existing build, expect missing capture link.
- [ ] Implement backend/migration and frontend with existing draft submission/retry handling; add sharp direct API dependency. Add generated article/photo to DTOs and public covers.
- [ ] Run full format/typecheck/build/tests/SSR/browser checks, expect all green. Commit; task-done with full tests; include in independent final branch review and deploy with order feature.
