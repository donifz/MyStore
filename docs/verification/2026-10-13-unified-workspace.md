# Unified workspace verification — 2026-10-13

## Result and scope

Platform administration, shop work and shop selection now share WorkspaceShell and the existing UI kit. The account identity stays stable; the context selector and role-filtered menu describe the current scope. Platform sections live in the URL. Login and legacy links use validated internal role-safe destinations.

No API, migrations, production permissions, finance or inventory logic changed. This PR requires merge and deployment before the hosted site changes.

## Checks

- `npm test`: 32 API suites / 180 tests and 17 web suites / 61 tests passed on the final implementation.
- `npm run typecheck`: all three workspaces passed.
- `npm run format:check`: passed with the installed Prettier configuration.
- `npm run build`: API, web and Next storefront passed. After the review's web-only helper correction, `npm run build --workspace apps/web` passed again.
- `npm run test:e2e --workspace apps/web`: all 33 production browser scenarios passed using Chrome and the local compiled service.
- Responsive role/context checks cover 360, 768, 1024 and 1440 px. Desktop independent scrolling, mobile document scrolling, print styles, keyboard cashier entry, checkout recovery, idempotent sale/returns, staff access, email workflows and document navigation to the current storefront remain covered.
- Desktop 1440 px and mobile 390 px screenshots of platform, audit, products and staff were captured; platform/products screenshots were visually inspected for spacing, context, account and overflow.

API tests used `TEST_DATABASE_URL=postgres://user@127.0.0.1:43102/mystore_test`; browser tests used a separate `mystore_browser_test` database. Browser service URL was `http://localhost:43104`. SMTP/Gmail test transports were local fixtures; no production DB or real recipients were involved.

One repeat API run was rejected by the dedicated-database guard because the command omitted TEST_DATABASE_URL. The corrected complete run passed. An earlier browser run was stopped after old fixture helpers assumed the old admin landing; helpers now explicitly select the fixture shop, while new tests independently assert the new landing behavior. Those incomplete runs are not counted as passing checks.

## Review

An independent whole-branch reviewer identified one P2: a legacy multi-shop hash link lost its destination when an administrator signed in. A new unit case first failed (1 failed, 5 passed), then passed after resolving that hash before the generic seller fallback. A production browser regression verifies the logged-out administrator with multiple shops reaches shop selection. No remaining findings or deferred minors.

## Implementation rulings

1. Accounts without rights use `/seller?view=shops` to show the common empty state and avoid an entry redirect loop. If wrong, only the empty-state route needs adjustment; no access is granted.
2. App integration established RED for the new landing/shell before routing changes. Browser tests verify integrated behavior without temporarily undoing working implementation. If wrong, the risk is a missing browser-only edge; the complete browser suite covers the agreed paths.
3. Existing workflow fixtures explicitly open their own shop after login; new navigation tests assert role landing separately. Denial text changed to the shared shell message, preserving no-foreign-request assertions. If wrong, a fixture could mask a default-landing regression; dedicated role-navigation cases guard it.

## Publication

Target: a new `codex/unified-workspace-flow` PR against verified GitHub main `c2a4e5aa6345d6b8681465fc98df3db8c96c52a3`. Main blob hashes were compared with the local baseline before publication. CI is not awaited, following the user's instruction. No merge or production deployment is performed here.
