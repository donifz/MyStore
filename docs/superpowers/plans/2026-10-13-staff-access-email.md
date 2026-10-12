# Staff Access and SMTP Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Владелец управляет сотрудниками, пользователи восстанавливают пароль, а SMTP worker отправляет приглашения и уведомления после фиксации операций.

**Architecture:** Общая доставка писем через PostgreSQL outbox; отдельные сервисы сотрудников и восстановления используют общую очередь и одноразовые токены. React кабинет содержит новые страницы, Next checkout принимает необязательный email. SMTP работает отдельным процессом, без сетевых вызовов внутри бизнес-транзакций.

**Tech Stack:** Node.js 24, TypeScript, Nest/Express, TypeORM/PostgreSQL, React, Next, Nodemailer, Jest/Supertest, Vitest, Playwright, локальный SMTP fixture.

**Spec:** `docs/superpowers/specs/2026-10-13-staff-access-email-design.md`

## Global Constraints

- Роли owner/manager/cashier сохраняются; приглашать можно только manager/cashier. SMS, онлайн-оплата, доставка и production-настройки вне этой реализации.
- Приглашение действует 7 дней; восстановление — 30 минут; токен минимум 32 случайных байта, проверка по SHA-256; пароль 12–256 символов.
- Изменение роли/отключение при открытой смене запрещены; история сохраняется.
- Все mutations имеют стабильный UUID ключ; повтор не создаёт дополнительные изменения и письма. Cookie mutations требуют Origin/CSRF.
- Секреты доставки шифруются AES-256-GCM отдельным 32-byte base64 ключом; логи и аудит не содержат токенов/SMTP-паролей.
- Повторы SMTP после ошибок: 1, 5, 15, 60, 240 минут; шестая ошибка переводит в failed. Постоянный Message-ID, at-least-once доставка с возможным дублем после неизвестного результата.
- Одноразовые страницы: no-store, noindex, Referrer-Policy: no-referrer; токен только в памяти после удаления из URL.
- После локальных проверок создать PR и завершить без ожидания CI. Не сливать и не менять production.

## Review Focus

1. Приглашённый email уже принадлежит аккаунту: предъявитель ссылки должен войти именно в него, пароль аккаунта не изменяется (Task 3).
2. Отзыв прав конкурирует с открытием смены: сериализация через shop row lock, которую должны использовать оба сценария (Task 3).
3. Старый checkout клиент не знает email: отсутствие поля равно пустому email и не меняет прежний idempotency fingerprint (Task 6).
4. SMTP принял письмо, процесс упал до записи результата: lease восстанавливает задачу, Message-ID остаётся прежним, возможен документированный дубль (Task 2).
5. Прежний outbox содержит исторические события: worker не отправляет старые письма при первом запуске (Task 1/6).

## Task 1: Миграции и безопасная постановка доставки

**Files:** Create `apps/api/src/migrations/1760000000013-StaffEmail.ts`, `apps/api/src/email/email.types.ts`, `apps/api/src/email/email-config.ts`, `apps/api/src/email/email-queue.service.ts`; modify `apps/api/src/database.ts`, `apps/api/src/app.ts`, `.env.example`; test `apps/api/test/email-queue.e2e-spec.ts`.

**Interfaces:**
- `StaffRole = 'manager' | 'cashier'`.
- `EmailMessage = {to:string; subject:string; text:string; secret?:{kind:'staff'|'reset'|'partner'; referenceId:string}}`.
- `EmailQueueService.enqueue(tx:EntityManager, dedupeKey:string, message:EmailMessage, shopId:string|null):Promise<string>` creates one email_delivery in caller transaction; encrypts subject/text when secret exists.
- `readEmailConfig(env:NodeJS.ProcessEnv):EmailConfig` validates enabled SMTP, PUBLIC_BASE_URL and encryption key; disabled mode has no network side effects.
- Tables: `staff_invitations` with shop/email/role/token_hash/expires_at/used_at/cancelled_at/created_by; `password_resets` with user/token_hash/expires_at/used_at; `email_preferences` per shop/user; `email_deliveries` with unique dedupe_key, shop_id, recipient, encrypted or ordinary payload, secret reference, status pending/sending/sent/failed/cancelled, attempts, available_at, lease_until, lease_token, message_id, timestamps, safe error. Add nullable `online_orders.email` and `outbox_events.email_dispatch_enabled DEFAULT true`; set existing outbox rows false during migration.

- [ ] Write `email-queue.e2e-spec.ts`: duplicate enqueue has one row; transaction rollback has none; secret plaintext absent in persisted columns; invalid key rejected; migrated pre-existing event has dispatch false while new event has true.
- [ ] Run `npm run test:e2e --workspace apps/api -- --runTestsByPath test/email-queue.e2e-spec.ts` with isolated TEST_DATABASE_URL; confirm failures from missing implementation.
- [ ] Implement migration/register it, queue and config; use authenticated encryption with fresh IV, redact errors and reject header newlines in addresses/subject. Add schema checks/bounded inputs and indexes for claims.
- [ ] Re-run queue tests; verify migration applies twice without pending work and down/up on a disposable migration database.
- [ ] Format changed files and commit `feat: add staff email persistence and encrypted queue`.

## Task 2: SMTP worker и повторная отправка

**Files:** Create `apps/api/src/email/email-worker.ts`, `apps/api/src/email/smtp-transport.ts`, `apps/api/src/scripts/email-worker.ts`, `apps/api/test/email-worker.e2e-spec.ts`, `apps/api/test/fixtures/smtp-server.ts`; modify `apps/api/package.json`, `package-lock.json`, `docs/operations.md`.

**Interfaces:**
- `SmtpTransport.send(message:EmailMessage, messageId:string):Promise<void>` resolves on accepted SMTP response.
- `EmailWorker.tick():Promise<number>` claims maximum 20 eligible deliveries using lease token/120-second lease; heartbeat every 30 seconds extends owned lease. Send timeout 30 seconds; DB acknowledgement requires matching lease token.
- `EmailWorker.stop():Promise<void>` stops new claims and drains bounded in-flight sends. Script runs tick every 5 seconds and handles SIGTERM/SIGINT. Package script `worker:email` runs compiled entrypoint.

- [ ] Write tests with local SMTP fixture accepting/rejecting/hanging messages: success, six failures and exact backoff, two workers, lost lease recovery, crash after send preserving Message-ID, one failed recipient not repeating sent recipients, expired/revoked secret cancelling delivery, terminal encrypted payload removed.
- [ ] Run targeted worker tests and observe missing implementation failures.
- [ ] Install Nodemailer and its TypeScript types using npm; implement transport/worker. Network is outside transactions; check secret validity before send, heartbeat lease and use conditional completion writes. Startup validates enabled config; disabled mode exits cleanly without claiming. Export failed/retry metadata without body or secret; fixed sanitized errors.
- [ ] Run worker tests and a compiled worker smoke against SMTP fixture; terminate it during an in-flight send and verify lease recovery.
- [ ] Format and commit `feat: deliver SMTP email with leases and retries`.

## Task 3: API сотрудников и одноразовые приглашения

**Files:** Create `apps/api/src/staff/staff.service.ts`, `apps/api/src/staff/staff.controller.ts`, `apps/api/test/staff.e2e-spec.ts`; modify `apps/api/src/app.ts`, `apps/api/src/pos/shifts.service.ts`.

**Interfaces:**
- Owner-only `GET /shops/:shopId/staff` returns members and pending invitations without tokens.
- `POST /shops/:shopId/staff/invitations` body `{email,role}`; `POST /shops/:shopId/staff/invitations/:id/cancel`; `POST /shops/:shopId/staff/:userId/role` body `{role}`; `POST /shops/:shopId/staff/:userId/disable`. Stable operation keys mandatory; same key/different body conflicts.
- Public `POST /auth/staff/accept` body `{token,password?}` creates new user or requires existing authenticated user with matching email; never resets existing password. Return `{accepted:true}`.
- `StaffService.invite(shopId:string,actorId:string,email:string,role:StaffRole,key:string)` queues email in transaction; acceptance consumes invitation once. Reissue uses a new key and cancels previous token/delivery.

- [ ] Write integration tests: owner success; manager/cashier denied; foreign shop; owner/self mutation denied; new/existing account accept; wrong account; expired/cancelled/used link; concurrent accept/reissue/cancel; repeated key; role/disable conflicts with open shift; role change does not affect financial history; concurrent shift opening; audit contains no token.
- [ ] Run targeted staff tests and confirm red.
- [ ] Implement API with DTO validation, Origin/rate limits on public accept, guarded owner mutations. Lock shop before reading actor membership and before shift opening; lock invitation and target membership consistently. Reuse existing idempotency conventions without caching raw token. Use existing password hash and sessions for acceptance.
- [ ] Run staff tests plus existing shifts/access tests; verify disabled member loses only this shop access immediately.
- [ ] Format and commit `feat: manage shop staff and email invitations`.

## Task 4: API восстановления и email партнёров

**Files:** Create `apps/api/src/auth/password-recovery.service.ts`, `apps/api/src/auth/password-recovery.controller.ts`, `apps/api/test/password-recovery.e2e-spec.ts`; modify `apps/api/src/auth/auth.service.ts`, `apps/api/src/platform/partner-applications.service.ts`, `apps/api/src/app.ts`, `apps/api/test/partner-applications.e2e-spec.ts`.

**Interfaces:**
- `POST /auth/password/forgot` body `{email}`, required operation key; always `{accepted:true}` for syntactically valid input. Rate limiter buckets independent from login.
- `POST /auth/password/reset` body `{token,password}`, operation key; `{reset:true}`. Same key retry may replay success; another key using consumed token fails.
- `PasswordRecoveryService.request(email:string,key:string):Promise<{accepted:true}>`; `reset(token:string,password:string,key:string):Promise<{reset:true}>`.
- Partner approval preserves existing activationUrl response and queues encrypted activation email atomically.

- [ ] Write tests: known/unknown email equal response; independent account/IP limits; password bounds; expiry; reissue; consumed link; concurrent reset; all sessions revoked; failed transaction leaves old password valid; same-key retry; no tokens in response/audit; partner approval queues exactly one invitation and rollback queues none.
- [ ] Run targeted tests and observe red.
- [ ] Implement random tokens and digests; lock user/reset row to serialize replacement and consumption; invalidate other resets, revoke sessions atomically. Use immutable request origin from PUBLIC_BASE_URL for links; neutral errors for email existence.
- [ ] Run recovery/partner/web-auth suites; check no change to login behavior.
- [ ] Format and commit `feat: recover passwords and email partner invitations`.

## Task 5: UI сотрудников и восстановления

**Files:** Create `apps/web/src/staff/StaffPage.tsx`, `apps/web/src/auth/StaffActivationPage.tsx`, `apps/web/src/auth/ForgotPasswordPage.tsx`, `apps/web/src/auth/ResetPasswordPage.tsx`, `apps/web/src/staff/StaffPage.test.tsx`, `apps/web/e2e/staff-access.spec.ts`; modify `apps/web/src/App.tsx`, `apps/web/src/auth/LoginPage.tsx`, `apps/web/src/layout/SellerLayout.tsx`, `apps/web/src/styles.css`, `apps/api/src/app.ts`.

**Interfaces:** Routes `/seller/:shopId/staff`, `/seller/staff/accept`, `/seller/forgot-password`, `/seller/reset-password`; services consumed from Tasks 3/4. Pending mutations retain the same key until definitive success/rejection; unknown result allows safe retry. One-time pages read token to memory then replace URL, never localStorage.

- [ ] Write UI tests for role options/owner gating, error and disabled state, stable retry key; write browser flows using fixture mailbox for new/existing employee and password reset, including wrong signed-in account and old-session rejection.
- [ ] Run tests against current build to verify red.
- [ ] Implement accessible labeled forms, confirmations for disabling/cancelling, invitation status without token, neutral recovery messages and login links. Add security headers for one-time seller and existing partner activation routes, and metadata for public activation page. No third-party resources.
- [ ] Run UI/browser tests at 390 and 1440 widths; inspect focus, overflow, long email and server errors. Check Referrer-Policy/no-store/noindex HTTP responses.
- [ ] Format and commit `feat: add staff and password recovery screens`.

## Task 6: Уведомления о заказах и модерации

**Files:** Create `apps/api/src/email/event-email.service.ts`, `apps/api/test/event-email.e2e-spec.ts`; modify `apps/api/src/orders/orders.service.ts`, `apps/api/src/orders/orders.controller.ts`, `apps/storefront/components/Checkout.tsx`, `apps/storefront/e2e/ui-kit.spec.ts`, `apps/api/test/orders.e2e-spec.ts`, `apps/api/src/email/email-worker.ts`.

**Interfaces:** `EventEmailService.expandBatch():Promise<number>` consumes eligible new order.status/product.moderation events under lock and enqueues deliveries keyed by event+recipient, then marks expansion complete separately from SMTP delivery. Each delivery tracks its result; an expanded source never implies successful SMTP.

- [ ] Write tests for all order status events, buyer with/without email, active owner/manager recipients, owner-only moderation, opted-out users, no purchasing costs in mail, historical backlog skipped, duplicate expansion, rollback and per-recipient failures.
- [ ] Extend checkout tests: omitted/null/empty email canonicalizes to absent; omitted legacy request keeps original fingerprint; supplied valid email persists and same key/different email conflicts; invalid email rejected without stock/reserve changes. Run red.
- [ ] Implement optional validated email DTO and schema usage without changing financial/stock operations. Add optional email input explaining purpose; email enters checkout retry body. Build plain-text Russian templates and snapshot event status rather than substituting latest status. Resolve active seller recipients respecting preferences; no email means no buyer delivery.
- [ ] Run event-email/orders tests and storefront browser checkout coverage against real API.
- [ ] Format and commit `feat: email order and moderation updates`.

## Task 7: Настройки и состояние доставки

**Files:** Create `apps/api/src/email/email-settings.controller.ts`, `apps/api/src/email/email-settings.service.ts`, `apps/api/test/email-settings.e2e-spec.ts`; modify `apps/web/src/operations/OperationsPage.tsx`, `apps/api/src/app.ts`, `apps/api/src/operations/health.controller.ts`; create `apps/web/e2e/email-status.spec.ts`.

**Interfaces:** Owner-only `GET /shops/:shopId/email/status`, `POST /shops/:shopId/email/deliveries/:id/retry`; per-user `GET/POST /shops/:shopId/email/preferences` body `{orders:boolean,moderation:boolean}`. Status exposes enabled/configured and own shop delivery metadata without content/tokens/recovery recipients. Retry is keyed and only for failed valid delivery; appends audit and requeues once.

- [ ] Write tests for cross-shop access, manager/cashier status/retry rejection, user-scoped preferences, defaults true, retry same key/no extra send, secret expired retry rejection, disabled status and redacted responses.
- [ ] Run targeted tests to confirm red.
- [ ] Implement settings/status API and UI sections; API must not reveal credentials in diagnostics. Health reports backlog age/count and failed counts, never recipients/payloads. Show SMTP acceptance wording, configuration disabled notice and safe retry confirmation.
- [ ] Run API tests and browser settings/retry flows on mobile/desktop with successful and rejected SMTP fixture.
- [ ] Format and commit `feat: expose email preferences and delivery diagnostics`.

## Task 8: Полная проверка и PR

**Files:** Modify `docs/operations.md`, `docs/seller-guide.md`, `README.md`, `.env.example`, `.github/workflows/ci.yml`; create `docs/email-setup.md`, `apps/web/e2e/email-fixtures.ts` as needed to centralize mailbox fixture.

- [ ] Document worker command, required variables, key generation and rotation after draining sensitive queue; explain SMTP accepted versus inbox delivered, possible duplicates, disabled behavior, six failures and retry, safe deployment order: migration → API → worker. Remove obsolete README claims only where this work proves current behavior.
- [ ] Run `npm run format:check`, `npm run typecheck`, `npm run build`, `npm test` with dedicated `_test` database. Confirm zero failures.
- [ ] After build completes, start fresh production API on isolated browser test database and local SMTP fixture. Run all `apps/web` Playwright and storefront Playwright suites sequentially; do not rebuild while browser reads dist. Cover complete staff → invitation → login → order email → recovery → revoked sessions → disabled access flow.
- [ ] Add deterministic fixture startup/teardown to CI; no SMTP secrets or emails to people. Run compiled standalone worker smoke and check shutdown.
- [ ] Inspect full diff and authorization/concurrency boundaries, get fresh branch review using available review capability, and fix material findings with regression tests. Record if independent review is unavailable without claiming it passed.
- [ ] Format last changes, re-run affected checks and `git diff --check`, commit. Push via available GitHub connector using latest main SHA as base after checking drift, create focused draft PR and attach it to this chat.
- [ ] Report local results, PR link and remaining SMTP configuration. Finish immediately after PR creation; do not wait for CI, merge or deploy.
