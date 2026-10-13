# Unified Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Один рабочий кабинет MyStore с понятным переключением платформы/магазинов, входом по роли и сохраняемой навигацией.

**Architecture:** Общая WorkspaceShell заменяет три самостоятельные оболочки. Чистые функции задают доступные контексты, начальный маршрут, допустимый адрес возврата и меню. Содержимое кабинетов и существующие API переиспользуются; URL хранит контекст и раздел платформы.

**Tech Stack:** React, TypeScript, React Router, существующий CSS/AdminKit, Vitest и Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-unified-workspace-design.md` — подтверждена пользователем 2026-10-13.

## Global Constraints

- Образец — `/platform/admin`; используем `docs/admin-ui-kit.md`, существующие AdminKit и `admin-kit-shell` токены.
- Не нужны новые зависимости, изменения базы, новая система ролей или новые публичные endpoints.
- Не меняются расчёты денег, остатки, идемпотентность, выдача заказов, модерация, Gmail и фискализация.
- Контексты и права берутся только из `/api/auth/me`; роль платформы не предоставляет membership чужого магазина.
- Проверяются 360/768/1024/1440 px, клавиатура, выход, отдельная прокрутка и печать этикеток.
- Из кабинета на публичную витрину выполняется переход документа в Next.js.
- Реализация выполняется здесь самим агентом; независимое ревью всей ветки перед PR. CI после PR не ожидается; автоматического слияния/deployment нет.

## Review Focus

1. Аккаунт одновременно admin и owner: обычный вход ведёт в платформу, переход в собственный магазин сохраняет тот же профиль; роль admin не добавляет чужих магазинов. Проверки задач 1 и 3.
2. Несколько магазинов с разными ролями: смена контекста применяет текущую роль, owner-only данные не запрашиваются для manager/cashier. Проверки задач 1–3.
3. Недоверенный адрес возврата: внешний URL, чужой shop ID и запрещённый раздел не обходят правила входа. Проверки задачи 1.
4. Прямая ссылка, обновление и назад/вперёд: section платформы остаётся в URL; активен ровно один пункт, неизвестный section ведёт в обзор. Проверки задач 1 и 3.
5. Узкий экран, длинный email/название и отсутствие магазинов: контекст/выход доступны, нет перекрытий и ложных финансовых нулей, печать и draft-сценарии сохранены. Проверки задач 2–4.

---

### Task 1: Правила входа, контекстов и меню

**Files:**
- Create: `apps/web/src/layout/workspace-navigation.ts`
- Test: `apps/web/src/layout/workspace-navigation.test.ts`

**Interfaces:**
- Consumes: `Me`, `Shop`, `Role` из `apps/web/src/api/types.ts`.
- Produces: `PlatformSection = 'overview' | 'applications' | 'products' | 'audit'`.
- Produces: `WorkspaceContext = { kind: 'platform' } | { kind: 'shop'; shop: Shop } | { kind: 'shops' } | { kind: 'empty' } | { kind: 'forbidden' }`.
- Produces: `shopStart(shop: Shop): string`, `workspaceStart(me: Me): string`, `workspaceReturn(me: Me, from: unknown): string | null`, `platformSection(search: string): PlatformSection`.
- Produces: `workspaceContext(me: Me, pathname: string, search: string): WorkspaceContext` and `workspaceMenu(context: WorkspaceContext, pathname: string, search: string): WorkspaceMenuGroup[]`; each group has `label` and items `{ label, href, active }`.

- [x] **Step 1: Write failing unit cases.** Admin+one shop starts at `/platform/admin`; sole owner/manager at products; sole cashier at pos; multiple shops at `/seller?view=shops`; no rights at `/seller?view=shops` with empty context. Test allowed owned-shop deep links; reject external/protocol-relative/backslash URLs, unknown shop IDs, cashier reports/returns, manager staff, and platform links without admin rights. Test all platform sections, unknown section fallback, shop product/edit/capture matching and exactly one active item.
- [x] **Step 2: Run RED.** `npm run test --workspace apps/web -- src/layout/workspace-navigation.test.ts` must fail because the helpers are absent.
- [x] **Step 3: Implement helpers.** Default-role rules and the exact existing shop routes come from the spec and `App.tsx`; URL-normalized return paths must remain internal and pass role/route checks. Build role-filtered menu groups and explicit match rules so products/capture and sales/returns cannot highlight two leaves. Never persist context grants in localStorage.
- [x] **Step 4: Run GREEN and typecheck web.** All helper cases pass, including admin without memberships and mixed-role shops.
- [x] **Step 5: Format and commit.** `feat: define workspace navigation and role landing rules`.

### Task 2: Общая оболочка рабочего кабинета

**Files:**
- Create: `apps/web/src/layout/WorkspaceShell.tsx`
- Test: `apps/web/src/layout/WorkspaceShell.test.tsx`
- Modify: `apps/web/src/platform/AdminKit.tsx`, `apps/web/src/styles.css`

**Interfaces:**
- Consumes: helpers from Task 1, `useSession()` from SessionProvider, existing AdminBrand/AdminKit components.
- Produces: `WorkspaceShell({ children, headerTools? }: { children: ReactNode; headerTools?: ReactNode })`.
- Produces: common shell classes preserving `.sidebar`, `.workspace`, `.topbar`, `.content` for desktop scrolling and current print rules. Platform/shops contexts may carry existing admin/partner classes where needed by content styling.

- [x] **Step 1: Write failing component cases.** Render admin+owner, cashier and mixed-role fixtures. Assert one brand labelled «Рабочий кабинет», stable account email, labelled context selector, accessible platform/shops options, correct role per selected context, grouped role-safe menu and one `aria-current="page"`. Check logout error visibility and no-rights empty state. Long identifiers remain text rather than injected markup.
- [x] **Step 2: Run RED.** `npm run test --workspace apps/web -- src/layout/WorkspaceShell.test.tsx` must fail because the shell is absent.
- [x] **Step 3: Implement shell and scoped CSS.** Use current pathname/search and server session to resolve context. Selector navigates only to permitted options; profile identifies the account, context identifies its role. Reuse AdminBrand with «Рабочий кабинет», style initials/email with existing tokens. Common header always explains current context; optional platform search uses headerTools. Hover differs from active state. Keep desktop independent scroll and mobile document/horizontal-menu behavior and logout/selector access.
- [x] **Step 4: Run GREEN and format.** Component cases and web typecheck pass. Preserve print selectors and prevent width expansion for long labels/email.
- [x] **Step 5: Commit.** `feat: add shared workspace shell and context selector`.

### Task 3: Подключить страницы и синхронизировать маршруты

**Files:**
- Create: `apps/web/src/layout/WorkspaceEntry.tsx`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/layout/SellerLayout.tsx`, `apps/web/src/layout/PartnerDashboard.tsx`, `apps/web/src/platform/AdminPage.tsx`
- Test: `apps/web/src/layout/WorkspaceEntry.test.tsx`, `apps/web/src/layout/PartnerDashboard.test.tsx`, `apps/web/e2e/workspace-navigation.spec.ts`
- Adjust: affected existing `apps/web/e2e/*.spec.ts` and fixture/session helpers.

**Interfaces:**
- Consumes: WorkspaceShell and Task 1 helpers.
- Produces: `/seller` entry redirects according to workspaceStart; `/seller?view=shops` explicitly renders common-shell shop selection/overview. Legacy `/seller#partner-shops` resolves safely. Existing protected page URLs and activation/recovery flows remain supported.
- Produces: platform query navigation `section=overview|applications|products|audit`, including overview shortcuts.

- [x] **Step 1: Write failing integration/browser cases.** Test ordinary login for admin/owner/manager/cashier; permitted login return and rejected foreign return; admin↔owned shop context switch with stable profile; multiple/mixed shops and no rights. Platform audit/products refresh and history retain section and a single active menu item. Legacy seller hash resolves without reintroducing a one-shop partner dashboard.
- [x] **Step 2: Run RED against the existing routes.** Unit and focused Playwright cases expose old landing, separate shells and tab reset.
- [x] **Step 3: Integrate.** Login uses workspaceReturn then workspaceStart. WorkspaceEntry handles entry/explicit shop view. SellerLayout keeps session/access checks and renders Outlet inside WorkspaceShell, removing duplicate chrome. PartnerDashboard becomes available-shop content with existing owner-only summary requests and no role-inaccurate rows; non-owner data is selection only. AdminPage removes its duplicate shell, moves search into headerTools and replaces local tab state with URL section; existing moderation/application/audit handlers and forms remain intact.
- [x] **Step 4: Run GREEN.** Update fixture login helpers to assert the appropriate landing instead of assuming every owner fixture with admin rights lands in products. Preserve tested cashier isolation, CSRF, moderation, access/recovery, uncertain-operation retries and storefront document navigation. Reuse fixture sessions to avoid redundant logins.
- [x] **Step 5: Format and commit.** `feat: route all workspaces through the unified cabinet`.

### Task 4: Проверить полный пользовательский путь и закрепить правила

**Files:**
- Modify: `docs/admin-ui-kit.md`, `AGENTS.md`, relevant `apps/web/e2e/layout.spec.ts`, `seller-scroll.spec.ts`, `admin-consistency.spec.ts`, `storefront-navigation.spec.ts`
- Create: `docs/verification/2026-10-13-unified-workspace.md`

**Interfaces:**
- Consumes: integrated routes/shell; existing dedicated test DBs, browser setup and OS-temp fixture-session helper.
- Produces: role/navigation regressions, responsive screenshots, verification record, reviewable PR against current main.

- [x] **Step 1: Extend failing checks for the remaining edges.** Add 360/768/1024/1440 px context/logout access and long identifiers; verify desktop independent scroll, one active item versus hover, label printing and valid empty/mixed-role shop selection. Each new behavior test must fail on its missing behavior before its final implementation.
- [x] **Step 2: Fix only demonstrated gaps.** Keep route permissions and API finance/stock invariants unchanged. Run focused tests to GREEN.
- [x] **Step 3: Verify full work.** Run format:check, typecheck, build, `npm test` and full production Playwright. Review desktop/mobile screenshots; retain successful cashier and money/stock scenarios. No production DB mutation or account grant is part of this task.
- [x] **Step 4: Independent whole-branch review.** Apply substantive findings with regression checks, then repeat only checks justified by changes. Record actual commands/results and limitations in verification doc; update UI-kit/AGENTS for shared-shell navigation.
- [x] **Step 5: Commit and publish PR.** Sync changed files into the workspace MyStore copy, upload against verified main SHA, attach PR. Do not wait for CI or merge/deploy. Final report links the PR and states how the user enters and switches the unified cabinet.
