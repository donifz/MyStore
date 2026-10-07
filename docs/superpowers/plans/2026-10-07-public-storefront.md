# Public storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Публичный каталог с общими остатками, публикацией магазина и регистрацией партнёров.
**Architecture:** Отдельный публичный DTO/API выбирает только разрешённые поля из существующих variants/stock_balances. Изменения профиля и регистрация транзакционны, React разделяет публичный layout и кабинет.
**Tech Stack:** Node 24, Nest, TypeORM, PostgreSQL18, React, Vite.
**Spec:** docs/superpowers/specs/2026-10-07-public-storefront-design.md

## Global Constraints

- Суммы — целые тыйыны; доступно = physical − reserved.
- Магазин скрыт по умолчанию, только owner публикует; продукт видим по умолчанию внутри опубликованного магазина.
- Только один действующий сервис Render; никаких демонстрационных записей в production.
- Регистрация не создаёт сессию; пароль ≥12, только scrypt hash.

## Review Focus

- Скрытый магазин/товар: публичная карточка 404, без финансовых данных.
- Повторная регистрация и параллельные запросы: один owner/shop, пароль не сбрасывается.
- Быстрая смена фильтра/магазина: старый ответ не заменяет новые результаты.
- Повторное открытие формы и продажа во время просмотра: актуальные значения, не старое наличие.
- Удалённый/несуществующий slug и невалидная пагинация: понятная ошибка без утечки SQL.

### Task 1: API витрин, регистрация и публикация

**Files:** migration 1760000000006-Storefront.ts, storefront service/controllers, database.ts/app.ts, variants service/controller, test/storefront.e2e-spec.ts.
**Interfaces:** GET /public/products and /public/stores => Page DTO; GET /public/stores/:slug => public profile; GET /public/stores/:slug/products/:id => safe product; POST /partners/register => {created:true}; GET/PUT /shops/:id/storefront => owner profile. PUT /shops/:id/variants/:id => catalog edit.

- [ ] Write integration tests: hidden defaults/owner-only profile; public no cost; receiving 5 then sale2 => available3; filtering literal %, pagination and sort; hide product and shop =>404; register repeat and concurrency =>one owner; wrong Origin/short password =>no records.
- [ ] Run dedicated test; expected missing endpoints 404.
- [ ] Implement migration, explicit DTO selects, owner guards, validation and transaction signup.
- [ ] Run API suite; expected all pass; commit.

### Task 2: Buyer and seller UI

**Files:** public layout, catalog/shop/product/partner pages, seller storefront settings and product editor, App.tsx, seller layout/catalog, CSS; web tests and storefront Playwright.
**Interfaces:** consume Task1 routes; public routes /, /shops, /shops/:slug, /shops/:slug/products/:id, /partner; owner /seller/:id/storefront and catalog /products/:id/edit.

- [ ] Add UI tests for safe loading/errors/empty catalog, partner success/password absence from storage, publication validation; run RED.
- [ ] Implement pages and refresh every30s/on focus with stale-response guard, explicit phone/contact action, footer, owner settings, product edit.
- [ ] Extend API static route serving for public deep links; browser test registration/login/publication/mobile, existing seller tests remain valid.
- [ ] Run build/typecheck/format/full tests; commit.

### Task 3: Review and deploy

- [ ] Update README and seller guide for actual stage boundaries and new routes.
- [ ] Independent whole branch review; important findings reproduced RED→GREEN, full suite green.
- [ ] Push isolated branch via GitHub guarded refs; PR; wait CI (Docker/HTTP/Playwright); merge after success.
- [ ] Render auto deploy; verify live root/public GET/private auth401/deep links; leave production shop hidden and no test registration data.
