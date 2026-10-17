# Business Hours Reservation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution or superpowers:subagent-driven-development if the owner selects that approach. Do not start implementation before the owner reviews this plan and selects the execution method.

**Goal:** Give a shop two working hours to confirm each new order, with editable weekly hours, explicit timezone and preserved checkout recovery.

**Architecture:** Keep NestJS, PostgreSQL and the existing transaction/lock order. Add one pure calendar calculator, shop settings and one stored UTC deadline per order. The React seller application edits the schedule; public checkout continues to use the existing contract.

**Tech Stack:** Node.js 24.15–24.x, TypeScript, NestJS, TypeORM/PostgreSQL, React, Jest, Vitest and Playwright. No new runtime dependency or service.

**Spec:** `docs/superpowers/specs/2026-10-17-business-hours-design.md`. Overall release scope: `docs/implementation/2026-10-17-release-scope.md`.

## Global Constraints

- Two working hours means 120 actual open minutes, including seconds carried across closed periods.
- Seven ISO weekdays, Monday first; each day has zero to two non-overlapping windows. Overnight windows belong to their opening day.
- Store instants in UTC; use explicit validated IANA timezone, default Asia/Bishkek.
- Preserve the existing 30-minute policy only for shops with no structured schedule. Never infer a schedule from free text.
- Old orders and retries retain their stored deadline. No recalculation of existing reservations.
- Keep stable operation keys, shop isolation, stock lock order and atomic rollback. No direct changes to historical money or movement records.
- Delivery development is excluded. Keep the existing fulfillment fields and behavior.
- Reuse WorkspaceShell and the admin UI kit; no duplicate sidebar or storefront CSS imports.
- Test only databases whose names end in `_test`. Browser production checks use `http://localhost:3001` for Secure-cookie compatibility.

## Review Focus

1. Friday night windows extending into a Saturday marked closed, and Sunday-to-Monday overlap: calculator and validator tests in Task 1.
2. Seconds and daylight-saving transitions: exact UTC assertions in Task 1; no rounded-away seconds.
3. Legacy clients omit new fields: preserve settings rather than erase them; API tests in Task 2.
4. Checkout recovery races with profile changes and expiration: persisted deadline/stock assertions in Task 3.
5. A failed settings save must retain all typed fields, including intervals: component tests in Task 4 and browser validation in Task 5.

## Task 1: One calendar contract and calculator

**Files:** Create `apps/api/src/orders/business-hours.ts` and `apps/api/test/business-hours.e2e-spec.ts`. Do not cherry-pick the old branch's duplicate `business-deadline.ts` or unrelated formatting changes.

**Interfaces:**

- `BusinessInterval = { open: string; close: string }`.
- `BusinessSchedule = BusinessInterval[][]`; runtime validation requires exactly seven day arrays, Monday first.
- `validateBusinessSchedule(value: unknown, timeZone: string): BusinessSchedule` returns a validated normalized copy or throws a descriptive Error.
- `businessDeadline(from: Date, schedule: BusinessSchedule, timeZone: string, minutes = 120): Date` returns a UTC instant or throws on invalid input/unreachable deadline.
- `formatBusinessSchedule(schedule: BusinessSchedule): string` returns a Russian description, with weekdays and overnight markers; used for the existing `hours` field.

- [ ] Write calculator/validator tests before adding the module. Assert: weekday 10:00–19:00, Friday `2026-10-16T12:00:00Z` → Monday `2026-10-19T05:00:00Z`; daily schedule at `2026-10-17T12:00:30Z` → `2026-10-18T05:00:30Z`; Friday 21:00–02:00 at 22:00 local → Saturday 00:00 local even with Saturday closed. Cover two intervals with a lunch break and exact opening/closing boundaries.
- [ ] Add DST assertions for Europe/Berlin: Sunday 01:00–05:00, `2026-03-29T00:00:00Z` plus 120 working minutes → `2026-03-29T02:00:00Z`; Sunday 02:00–03:00, `2026-10-25T00:00:00Z` → `2026-10-25T02:00:00Z`.
- [ ] Reject unknown timezone, invalid Date, malformed HH:mm, equal endpoints, more than two windows, less/more than seven days, empty week, less than 120 weekly minutes, same-day overlaps and overnight overlaps across the end of the week. Accept adjacent windows.
- [ ] Run `npm run test:e2e --workspace apps/api -- --runTestsByPath test/business-hours.e2e-spec.ts` and confirm failure is caused by the missing module.
- [ ] Implement one bounded calculator: use `Intl.DateTimeFormat` with explicit timezone/weekday and walk real UTC minute segments for at most 14 days. Consume segment duration in milliseconds, splitting the first segment at the next minute boundary so seconds are preserved. Weekly interval membership must include previous-day overnight carryover. Do not add a second calculator.
- [ ] Run the same tests to green; format the files and commit the calculator/tests as a focused change.

## Task 2: Persist and validate owner settings

**Files:** Create `apps/api/src/migrations/1760000000017-BusinessHours.ts` and `apps/api/test/business-hours-settings.e2e-spec.ts`. Modify `apps/api/src/database.ts`, `apps/api/src/storefront/storefront.controller.ts` and `apps/api/src/storefront/storefront.service.ts`.

**Consumes:** Task 1 validation and human-readable formatting.

**Produces:** Owner profile GET/PUT fields `timeZone: string`, `businessSchedule: BusinessSchedule | null`, `reservationPolicy: 'business-hours' | 'legacy-30-minutes'`, `confirmationPreview: { from: string; expiresAt: string }`. Preview is calculated on the server using the returned settings; it is explanatory and never reserves stock. Public profile responses continue to expose `hours` only.

- [ ] Write integration tests asserting defaults `Asia/Bishkek`/null/legacy; valid save and GET roundtrip; manager/cashier/other-shop 403; invalid timezone, overlap and empty week 400 with the entire previous profile unchanged. Create an explicit manager fixture through the existing DB test utilities.
- [ ] Assert a legacy PUT omitting both new fields preserves configured settings; explicit null clears the schedule and restores the labeled legacy policy. Changing only timezone validates against the retained schedule.
- [ ] Assert one audit record for a real timezone/schedule change, containing shop and actor; no extra record for unchanged settings and no record/profile update after an injected audit failure. Preview must equal Task 1's result for its returned `from` instant.
- [ ] Run `npm run test:e2e --workspace apps/api -- --runTestsByPath test/business-hours-settings.e2e-spec.ts` to red.
- [ ] Add nullable JSONB schedule and non-null timezone default without interpreting old `hours`. Add a database check for null or a seven-element JSON array. Register the migration after ProductAlbums; provide down migration that removes only these new fields/constraints.
- [ ] Extend `ProfileInput`/DTO and change `updateProfile(shopId: string, input: ProfileInput, actor: string)`; pass authenticated actor from the controller. Lock shop `FOR UPDATE`, merge omitted fields from current row, validate, update and audit in the same transaction. Derive `hours` from a configured schedule; retain editable legacy `hours` while schedule is null.
- [ ] Run new API tests and existing storefront tests to green. Verify migration up/down/up on a disposable database preserves shop IDs, old text hours and existing orders. Format and commit.

## Task 3: Apply the deadline inside checkout

**Files:** Modify `apps/api/src/orders/orders.service.ts` and extend `apps/api/test/orders.e2e-spec.ts`. Add `apps/api/test/business-hours-orders.e2e-spec.ts` for new focused transaction/race cases. Keep `order-expiration.service.ts` unchanged unless a reproduced test exposes a necessary change.

**Consumes:** Task 1 calculator and Task 2 persisted shop fields.

**Produces:** The existing `expiresAt` receipt field now reflects business hours for configured shops. Private order DTOs additionally expose the shop `timeZone` for seller display; no schedule is included in public receipts.

- [ ] Write tests for configured/unconfigured shops, retry after changing schedule, and old order after profile update. Assert exact stored/returned deadline, one order, one set of lines and `physical=5,reserved=2,stock_value_minor=40000` for the existing 5-unit/8000-cost fixture after a two-unit reservation.
- [ ] Derive expected deadlines from the PostgreSQL transaction time returned by `SELECT now()` and the shared calculator; keep exact fixed-time calendar examples in Task 1. Avoid global fake timers that interfere with sockets or database clients.
- [ ] Add a failing invalid-calculation case using a deliberately corrupted schedule in a disposable fixture; assert no order/lines/reservations are left. Assert unchanged counts of stock documents and payment records.
- [ ] Add expiration/restart tests by preparing already-due persisted deadlines, not waiting in real time. Concurrent expiration/confirmation must end either confirmed with its reserve retained or expired with reserve zero. Re-running the sweep has no additional stock effect. Confirmed orders are excluded.
- [ ] Run focused order tests to red.
- [ ] Read `time_zone,business_schedule` with the existing shop `FOR SHARE` lock and use PostgreSQL transaction time as calculation origin. Bind the computed Date as a SQL parameter instead of the hardcoded `30 minutes` expression. Keep existing-key recovery before new-order calculation and preserve the order of order/stock locks.
- [ ] Run focused tests plus existing orders/receiving/sales/returns suites. Verify no money rows or physical movements are created by reserving/expiring. Format and commit.

## Task 4: Seller settings and readable deadlines

**Files:** Create `apps/web/src/storefront/BusinessHoursEditor.tsx` and `apps/web/src/storefront/StorefrontSettingsPage.test.tsx`. Modify `apps/web/src/storefront/types.ts`, `apps/web/src/storefront/StorefrontSettingsPage.tsx`, `apps/web/src/orders/OrdersPage.tsx`, and scoped rules in `apps/web/src/styles.css`.

**Consumes:** Task 2 profile fields and preview; Task 3 private order timezone.

**Produces:** `BusinessHoursEditor({ value, timeZone, disabled, onChange, onTimeZoneChange })`, where value is `BusinessSchedule | null`; controlled inputs preserve the parent's unsaved state. Browser validation provides field guidance; API remains authoritative.

- [ ] Add component tests to red: legacy warning, enabling an explicitly chosen schedule, seven weekdays, closed day, second interval, overnight label, explicit copy-Monday-to-weekdays action, timezone selection and server preview. Disabling the schedule must show the 30-minute warning before save.
- [ ] Assert a rejected save preserves timezone, all typed intervals and other profile fields, and announces the error. Assert busy state disables mutations and successful save displays the returned normalized state.
- [ ] Assert manager/cashier settings show access denial and never send PUT. Add order display assertions that the saved UTC deadline is formatted using its supplied timezone, including a time that falls on a different local date.
- [ ] Run `npm run test --workspace apps/web -- src/storefront/StorefrontSettingsPage.test.tsx` to red.
- [ ] Implement a card labeled «Рабочие часы и резерв», visible labels/unique IDs, `type=time` controls, timezone input with IANA examples, copy button and per-day error text. Use existing form-panel/page-stack/actions tokens. Keep contacts/publication controls and delivery toggle behavior unchanged.
- [ ] Show the server-provided preview only for the saved configuration; after an unsaved edit label it as requiring save, avoiding an incorrect live prediction. Show order deadlines in shop timezone with a visible timezone label.
- [ ] Run relevant Vitest tests, typecheck and Prettier. Verify no new styles leak into the public storefront. Commit.

## Task 5: Browser acceptance and visual verification

**Files:** Create `apps/web/e2e/business-hours.spec.ts`. Update `docs/admin-ui-kit.md` with the schedule card layout only after the browser check confirms it.

**Consumes:** Tasks 2–4 complete flow. Reuse existing `owner-session.ts`; do not create repeated logins for every assertion.

- [ ] Add browser tests before final visual adjustments: at 390/768/1440 px, owner edits weekday/weekend hours and timezone, saves, reloads and sees the same values; overnight hint and legacy warning are accurate. No horizontal page overflow, field labels present, copy action keyboard-accessible, tab focus visible.
- [ ] Through real API fixtures verify a newly created order's deadline matches the saved schedule. Assert a schedule edit does not change the existing order. Do not submit orders to production.
- [ ] Add manager/cashier API denial assertions and one browser access-denial case with dedicated fixture accounts. Assert invalid intervals do not show a false success and retain entered values.
- [ ] Run `npm run test:e2e --workspace apps/web -- business-hours.spec.ts` against a built server connected to a separate `_test` database. Inspect screenshots at all three sizes; fix measured layout issues using the existing UI kit.
- [ ] Run all seller and storefront Playwright tests after layout changes. Preserve independent desktop scroll, mobile menu, checkout recovery, print styles and shop switching. Format and commit.

## Task 6: Full verification and delivery record

**Files:** Update `README.md`, `docs/seller-guide.md`, `docs/implementation/2026-10-17-release-scope.md`; create `docs/verification/2026-10-17-business-hours.md` with actual executed results and limitations.

- [ ] Record setup/migration commands, owner workflow, legacy transition policy, unchanged existing deadlines and how expiration is verified. Mark only the working-hours part complete; keep later release parts pending.
- [ ] Run `npm run format:check`, `npm run typecheck`, `npm run build`, `node scripts/storefront-ssr-test.cjs` and full `npm test` on Node 24 with PostgreSQL 18. Read exit codes and actual test counts. Pure tests must appear in the normal Jest run.
- [ ] After the build, run all storefront Playwright tests, then production-server seller Playwright tests against the separate browser database. Do not run Next dev fixtures and production build against the same `.next` concurrently.
- [ ] Run `git diff --check`; review migrations, profile omissions/null handling, lock order, retry path, DST/seconds and screenshots against the spec. Complete one independent branch review using the execution method selected by the owner.
- [ ] Create a focused PR for working hours/reservations with spec, changes, migration behavior and real verification evidence. After pushing, inspect GitHub Actions and fix failures in this PR. Do not merge a failing PR. No production database changes during local testing.

## Deferred parts

Rights/financial access, catalogue search/archive/variant groups, cash operations, platform management and the wider visual refresh remain tracked in the release-scope document. They are separate deliverables, not hidden additions to this reservation change. Hardware, fiscal provider credentials and real restore/load experiments require their actual external prerequisites.
