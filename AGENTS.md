# MyStore development rules

These instructions apply to every change in this repository, including code written by AI assistants.

## Priority and scope

- MyStore is primarily a **point-of-sale and inventory system**. Protect cash, stock, financial history, and customer trust before adding marketplace features.
- Keep each PR focused. Make separate commits for functional changes, regression tests, and formatting when practical.
- Never claim a check passed unless it actually ran and passed. Never merge a failing PR.

## Required code quality gates

1. Use the project's own Prettier configuration and installed version; do not guess JSX, CSS, or TypeScript formatting.
2. After editing code, run `npx prettier --write path/to/changed-file.ts` (or `npm run format`) **before committing**.
3. Run `npm run format:check` before every push and again after the last code change.
4. Run `npm run typecheck`, `npm run build`, and relevant tests before requesting merge.
5. Check GitHub Actions after pushing; fix its failures in the same PR.
6. Do not alter formatting rules or disable checks just to make a failed build green.

## Cash register and inventory invariants

- No empty receiving, sale, return, count, or write-off document.
- Never use floating-point arithmetic for stored currency; use integer minor units and checked bounds.
- All stock and payment changes for one operation must commit in one PostgreSQL transaction.
- Every mutation must be idempotent using a stable operation key; a retry must not duplicate a sale, refund, receipt, or inventory movement.
- Lock stock/shift rows consistently to prevent overselling, double refunds, and sales against closed shifts.
- Never update or delete immutable ledger/movement history to hide mistakes; post compensating documents instead.
- Check shop isolation and authorization in the API, not only in the UI.
- Do not mark a sale fiscalized without a real authorized KKM response.

## Tests

- For any inventory/POS change, test both the successful path and rejection/rollback paths.
- Verify complete flows: receiving → stock → sale → return, and opening shift → payments/refunds → closing shift.
- Assert resulting stock quantities, stock value, cash expectations, and ledger/payment row counts.
- Cover concurrency and retry behavior for business-critical mutations.
- For UI changes, add Playwright checks for navigation and responsive screens. Await successful login/navigation before asserting protected UI.

## Local pre-commit hook

Run `npm run hooks:install` once in your local clone. The tracked `.githooks/pre-commit` hook runs `npm run format:check` and blocks commits with unformatted files. GitHub CI is the final independent gate.

## Workspace UI

- Treat `/platform/admin` as the visual reference for protected workspaces. Follow `docs/admin-ui-kit.md` and reuse `apps/web/src/platform/AdminKit.tsx` and the `admin-kit-shell` tokens.
- Keep navigation labels consistent with their destinations. Crossing from the seller React application to the Next storefront requires document navigation.
- Check mobile spacing, table overflow, checkbox sizing, logout access, multiple-shop selection, and desktop independent scroll regions after layout changes.
- Protected pages use `apps/web/src/layout/WorkspaceShell.tsx`; add context/menu/role rules in `workspace-navigation.ts`, not duplicate sidebar layouts. Keep account identity stable across contexts and current platform sections in the URL.
