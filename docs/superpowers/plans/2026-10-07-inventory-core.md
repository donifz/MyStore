# MyStore Inventory Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Создать проверяемое серверное ядро MyStore: магазин, товары, приход, остатки и продажа со сканером на ноутбуке.

**Architecture:** Модульный монолит NestJS и PostgreSQL. Каждый запрос сотрудника проверяет принадлежность магазину; проведение документов и идемпотентность выполняются в одной транзакции. Этот этап создаёт API и тестируемые правила учёта; веб-интерфейсы, маркетплейс, оплата, ККМ и печать входят в отдельные планы.

**Tech Stack:** TypeScript, Node.js LTS, NestJS, PostgreSQL, TypeORM, Jest, Docker Compose. Точные поддерживаемые версии фиксируются в lockfile после проверки официальной документации при реализации.

**Spec:** `docs/superpowers/specs/2026-10-07-mystore-design.md`

## Global Constraints

- KGS; количество целое и положительное для операций. Один склад и одна точка на магазин в пилоте.
- Доступно = физический остаток − резерв. Отрицательный доступный остаток запрещён.
- Код товара хранится строкой с ведущими нулями. Код уникален среди активных вариантов одного магазина.
- Закупочная стоимость закрыта от кассира; владелец имеет доступ.
- Проведённые движения неизменяемы; повтор операции не создаёт дублей.
- Основной комплект: ноутбук + USB-сканер без экрана + принтер этикеток. Этот этап покрывает ввод кода через API; интеграция принтера будет отдельно.
- Онлайн-режим; неподтверждённая сервером операция не считается проведённой.
- Денежные суммы в тыйынах целыми числами; время UTC.

## Review Focus

1. Подмена shop_id или ссылки на чужой вариант не раскрывает чужие данные — тесты задачи 1 и 2.
2. Повтор запроса после подтверждения не удваивает приход или продажу — тесты задач 3 и 4.
3. Два кассира покупают последнюю единицу — успешна одна продажа, тест задачи 4.
4. Ведущие нули, пустые коды и дубли кодов не ломают поиск — тест задачи 2.
5. Переполнение суммы и дробное количество отклоняются до записи — тесты задач 3 и 4.

## Files and boundaries

- `apps/api/src/auth/`: вход, хеширование пароля, сессия сотрудника.
- `apps/api/src/shops/`: магазин и членство; ShopAccessService.
- `apps/api/src/catalog/`: варианты и поиск по коду; отдельные DTO для владельца и кассира.
- `apps/api/src/inventory/`: баланс, движения, проведение прихода.
- `apps/api/src/pos/`: проведение продажи и позиции; на этом этапе нефискальный внутренний контур.
- `apps/api/src/common/`: валидация денег и количества, идемпотентность, ошибки API.
- `apps/api/src/migrations/`: схема, ограничения и миграции.
- `apps/api/test/`: интеграционные проверки с настоящим PostgreSQL.
- `compose.yaml`, `.env.example`, `.github/workflows/ci.yml`: воспроизводимое окружение и CI без секретов.

## Task 1 Access and tenant isolation

**Files:** создать `apps/api/src/auth/auth.service.ts`, `apps/api/src/shops/shop-access.service.ts`, начальную миграцию и `apps/api/test/access.e2e-spec.ts`; настройки API, Compose и CI относятся к этой задаче.

**Interfaces:** `ShopAccessService.requireMembership(userId: string, shopId: string, permission: ShopPermission): Promise<Membership>`; API `POST /auth/login` принимает email и пароль; защищённые запросы используют сессию сотрудника. Регистрация продавцов через SMS и модерация будут в следующем плане. Тестовые аккаунты создаются отдельной командой seed только для локального окружения.

- [ ] Написать интеграционные тесты `ownerCanAccessOwnShop`, `foreignShopIsForbidden`, `anonymousIsUnauthorized`, `cashierCannotReceiveStock`; утверждения: 200, 403, 401 и 403 соответственно. Проверить, что неправильный пароль не раскрывает существование аккаунта.
- [ ] Запустить `npm run test:e2e --workspace apps/api -- access.e2e-spec`; зафиксировать отказ из-за отсутствия реализации.
- [ ] Реализовать модули, миграции пользователей и членства, хеширование, вход, отзыв сессии, guard и ограничения ролей. Секрет сессии обязателен через окружение.
- [ ] Повторить тесты; проверить миграцию на пустой базе и повторный запуск без разрушения данных. Ожидается PASS.
- [ ] Commit: `feat: add shop access and isolated API foundation`.

## Task 2 Variants and barcode lookup

**Files:** создать `apps/api/src/catalog/variants.service.ts`, `variants.controller.ts`, миграцию вариантов и `apps/api/test/variants.e2e-spec.ts`.

**Interfaces:** `createVariant(shopId, input: {name: string; barcode?: string; salePriceMinor: number}): Promise<Variant>`; `findByBarcode(shopId: string, barcode: string): Promise<Variant | null>`. Маршруты `POST /shops/:shopId/variants`, `GET /shops/:shopId/variants/by-barcode?code=...`. DTO кассира не содержит себестоимости.

- [ ] Написать тесты: код `0012345678905` возвращается без потери нулей; повтор кода внутри магазина → 409; тот же код у другого магазина разрешён; пустое название и отрицательная цена → 400; чужой variantId не читается; ответ кассиру не содержит закупочной стоимости.
- [ ] Запустить `npm run test:e2e --workspace apps/api -- variants.e2e-spec`; ожидается FAIL до реализации.
- [ ] Реализовать валидацию и сервис, ограничения базы и генерацию внутреннего строкового кода при отсутствии заводского. Создание варианта не меняет остаток.
- [ ] Повторить тесты; ожидается PASS.
- [ ] Commit: `feat: add variants and scoped barcode lookup`.

## Task 3 Transactional receiving

**Files:** создать `apps/api/src/inventory/receiving.service.ts`, `stock.service.ts`, миграции балансов и журнала, `apps/api/src/common/idempotency.service.ts`, `apps/api/test/receiving.e2e-spec.ts`.

**Interfaces:** `receive(shopId: string, actorId: string, key: string, lines: ReceiveLine[]): Promise<ReceiptResult>`; `ReceiveLine = {variantId: string; quantity: number; unitCostMinor: number}`. `POST /shops/:shopId/receivings` требует `Idempotency-Key`. `StockService.getBalance(shopId, variantId)` возвращает physical, reserved, available и стоимость запаса только разрешённой роли.

- [ ] Написать тесты: приход 10 по 10000 тыйын → physical=10, reserved=0, available=10; повтор ключа не создаёт второго движения; тот же ключ с другим телом → 409; один чужой вариант откатывает весь документ; quantity=0 или 1.5 → 400; переполнение вычисления → 400 без записи.
- [ ] Запустить `npm run test:e2e --workspace apps/api -- receiving.e2e-spec`; ожидается FAIL.
- [ ] Реализовать приход и запись идемпотентного результата в одной транзакции, блокировки в порядке variantId, журнал и средневзвешенную стоимость. Внутри БД хранить точную стоимость запаса; преобразование сумм в API проверять на безопасный диапазон целого числа.
- [ ] Повторить тесты, включая искусственную ошибку второй позиции; ожидается PASS и отсутствие частичных изменений.
- [ ] Commit: `feat: add atomic stock receiving and idempotency`.

## Task 4 Atomic sales and stock protection

**Files:** создать `apps/api/src/pos/sales.service.ts`, `sales.controller.ts`, миграцию документов продажи, `apps/api/test/sales.e2e-spec.ts`.

**Interfaces:** `sell(shopId: string, actorId: string, key: string, lines: SaleLine[]): Promise<SaleResult>`; `SaleLine = {variantId: string; quantity: number; expectedUnitPriceMinor: number}`. `POST /shops/:shopId/sales` требует `Idempotency-Key`. При изменении цены сервер возвращает 409 с актуальной ценой и не проводит продажу.

- [ ] Написать тесты: после прихода 10 продажа 2 оставляет physical=8; reserved=3 при physical=3 запрещает продажу; две конкурентные продажи последней единицы дают один успех и один 409; повтор ключа возвращает исходную продажу; дробное количество и переполнение → 400; ошибка последней позиции откатывает все списания.
- [ ] Запустить `npm run test:e2e --workspace apps/api -- sales.e2e-spec`; ожидается FAIL.
- [ ] Реализовать блокировку балансов, проверку цены и доступности, документ со снимком цены и себестоимости, списание и идемпотентный результат одной транзакцией. Этот API не выдаёт документ за фискальный чек и не выполняет банковскую оплату.
- [ ] Повторить тесты на реальной базе, затем `npm run build --workspace apps/api` и полный `npm run test:e2e --workspace apps/api`; ожидаются PASS и успешная сборка.
- [ ] Commit: `feat: add atomic sales with stock protection`.

## Task 5 Delivery of the first stage

**Files:** `README.md`, `docs/api-inventory.md`, CI и `.env.example`.

- [ ] Описать запуск Compose, миграции, seed, тесты и примеры lookup → receiving → sale. Примеры используют только тестовые данные.
- [ ] На чистой базе пройти приход 10 и продажу 2 через API, получить available=8; проверить отсутствие секретов в коммите.
- [ ] Выполнить typecheck, сборку и интеграционные тесты в CI. Приложить результаты в PR.
- [ ] Открыть PR первого этапа; не сливать до принятия результата пользователем.

## Following plans

Отдельными этапами: UI приёмки и кассы со сканером, смены и возвраты; фото и печать этикеток; публичный каталог и модерация; резервирование и онлайн-заказы; фискальная интеграция и коммерческий пилот. Первый этап не считается готовым маркетплейсом.
