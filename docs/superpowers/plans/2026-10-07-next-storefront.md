# Next public storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver server-rendered public MyStore pages on the existing Render service.
**Architecture:** Next App Router serves public pages through a custom handler mounted in Nest; Vite serves seller UI. SSR reads anonymous DTOs over trusted loopback without caching.
**Tech Stack:** Next16.4.0, React19, Nest11, PostgreSQL18, Node24.
**Spec:** docs/superpowers/specs/2026-10-07-next-storefront-design.md

## Global Constraints
- Work only in donifz/MyStore; keep one free Render service and existing env/account data.
- Keep public routes and seller/API contracts; no new order or photo features.
- SSR no-store,10-second timeout,no forwarded cookies; page1..1000000,size24,refresh30 seconds.
- Real404 for hidden/missing records, upstream failure distinct from empty; no production demo data.
- Pin Next16.4.0, Node24.19; no credentials in HTML/client props.

## Review Focus
- Missing/hidden profiles and malicious script-like product descriptions must never become an indexable data leak: Task2 HTTP tests.
- Query page negative/fraction/huge and unsupported sorts must remain navigable: Task2 HTTP tests.
- Public middleware must not intercept /api or legacy private /shops/:id/storefront: Task1 routing tests.
- Stock changing and products disappearing must be reflected with no cache and preserved backward navigation: Task2 HTTP tests.
- Runtime startup must not require build-time database or a second Render resource: Task2 build/Docker/browser tests.

### Task 1: Integrate the public request handler
**Files:** Modify apps/api/src/app.ts,apps/api/src/main.ts; create apps/api/test/public-handler.e2e-spec.ts.
**Interfaces:** createApp(db:DataSource,publicHandler?:express.RequestHandler); callers without handler retain current behavior. Main prepares Next with dir apps/storefront only when its production build exists.
- [ ] Write routing integration tests with a public handler returning HTML: public routes reach it, /api/auth/me remains401, private legacy storefront stays401, _next asset served; hidden product handler404 stays404.
- [ ] Run test RED: existing createApp ignores supplied handler, public response lacks requested content.
- [ ] Add allowlisted public middleware before static fallback; configure Next in main using public dir and close on shutdown.
- [ ] Run API suite, expected all pass; commit.
Whole-task verification: npm run test:e2e --workspace apps/api.

### Task 2: SSR public pages and runtime delivery
**Files:** Create apps/storefront/{package.json,tsconfig.json,next.config.ts,app,components,lib}; modify root package.json/package-lock.json,Dockerfile,.gitignore,.prettierignore,scripts/smoke.cjs,.github/workflows/ci.yml,docs/storefront-guide.md; create scripts/storefront-ssr-test.cjs.
**Interfaces:** Consumes existing anonymous /api/public/* DTOs and Task1 handler. Produces complete HTML at existing public routes, metadata/JSON-LD,sitemap/robots and same partner API form.
- [ ] Add real HTTP tests backed by a local anonymous API fixture: initial HTML has product names/prices/availability without JS; hidden404; API failure shows error; escaping prevents injected script; normalized queries; page2 shrinking retainsback; repeated read sees changed stock; sitemap only publishedstores,canonicaltrustedbase. Run RED against pre-migration Vite HTML.
- [ ] Implement server data loader/types/query normalizer/metadata helper; App Router layouts/pages and small refresh/registration client components. Reuse current CSS design and partner validation; preserve seller anchors.
- [ ] Pin Next16.4.0; add workspacebuild/typecheck/tests, Docker artifacts/cachepermissions. Change smoke assertion from root div to public heading; CI runs SSR HTTP tests after build and before Docker, then existing browser flows.
- [ ] Run build without DB, SSR HTTP suite, full API/web suites/typecheck/format, expected all pass. Commit and record whole-task test.
Whole-task verification: node scripts/storefront-ssr-test.cjs.

## Release
Fresh independent whole-branch review, fix important issues with failing tests first. Upload exact tree to GitHub feature branch, PR and final CI. Merge only green expectedhead; wait Render auto deploy, read-only SSR/live/browser checks, report actual result and limitations.
