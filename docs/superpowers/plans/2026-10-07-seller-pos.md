# Seller POS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Завершить браузерный контур продавца: вход, товары, приёмка и продажа сканером, смены, история и возвраты.

**Architecture:** apps/web обращается к NestJS через /api одного origin. Новые кассовые операции используют существующие блокировки остатков и IdempotencyService; товарные и денежные записи проводятся на одном EntityManager. Старый товарный API сохраняется.

**Tech Stack:** React, TypeScript, Vite, Vitest, React Testing Library, Playwright; NestJS 11, TypeORM, PostgreSQL 18, Jest/Supertest. Существующий Node.js >=24.15 <25.

**Spec:** docs/superpowers/specs/2026-10-07-seller-pos-design.md — утверждено пользователем 7 октября 2026.

## Global Constraints

- Одна касса на магазин; только одна открытая смена.
- Русский интерфейс, KGS, отображение времени Asia/Bishkek.
- Деньги — целые тыйыны; расчёты себестоимости через bigint.
- Поддерживается USB HID scanner с суффиксом Enter.
- Токен авторизации не хранится в localStorage.
- Работа требует сети. Автоматическое фоновое проведение запрещено.
- Возврат в этом этапе доступен только владельцу.
- Фото, принтер, публичная витрина и онлайн-заказы сохраняются для следующих этапов.
- Себестоимость и приёмка недоступны кассиру.
- Исторические документы не изменяются; платежи старым продажам не приписываются.

## Review Focus

- Истёкшая cookie при сохранённом pending-запросе: повтор возможен после входа тем же сотрудником, но операция не переносится другому пользователю (задачи 1, 6).
- Два окна браузера проводят один черновик: один ключ и один документ; второе окно не удаляет более новый черновик (задача 6).
- Ответ lookup приходит после переключения магазина: товар не попадает в чужую корзину (задача 6).
- Возврат после новых приходов и дробного распределения тыйынов: восстанавливается точный исторический снимок (задача 4).
- Ошибка localStorage или повреждённый JSON: приложение продолжает открываться, проведение блокируется, если pending не удалось надёжно сохранить (задача 6).

---

## Карта файлов и порядок

Изменения сервера следуют текущему паттерну controller/service, SQL через EntityManager, миграции явно зарегистрированы в database.ts. apps/web разбивается по функциям; не создавать один компонент со всей кассовой логикой.
Задачи 1–4 дают тестируемые API; задача 5 даёт работающий кабинет; задача 6 добавляет проведение документов и сканер; задача 7 завершает смены/возвраты и поставку. Выполнять последовательно, коммитить каждую задачу.

Общие DTO определяются в apps/api/src/pos/pos.types.ts и документируются в docs/api-pos.md. Веб-клиент зеркалит безопасные DTO в apps/web/src/api/types.ts; поля себестоимости не входят в кассовые типы.
Все новые UUID нормализуются к lowercase до отпечатка операции. Изменяющие маршруты требуют Idempotency-Key. Отпечаток включает actorId: другой сотрудник не получает результат чужой операции через известный ключ.

### Task 1: Cookie-вход и чтение товаров

**Files:** Modify apps/api/src/auth/{auth.service,auth.guard,auth.controller}.ts, apps/api/src/catalog/{variants.service,variants.controller}.ts, apps/api/src/app.ts, .env.example.
Create apps/api/src/auth/{web-auth.controller,browser-security}.ts.
Test apps/api/test/web-auth.e2e-spec.ts, apps/api/test/catalog-list.e2e-spec.ts.

**Interfaces:**
- POST /auth/web/login {email,password} -> {expiresIn:43200,csrfToken}; HttpOnly cookie mystore_session, Path=/, SameSite=Lax, Secure в production.
- GET /auth/me -> {userId,email,csrfToken,shops:[{id,name,role}]}.
- POST /auth/web/logout -> {revoked:true}; отзывает токен, очищает cookie.
- GET /shops/:shopId/variants?q=&page=1&pageSize=25 -> {items:[{id,name,barcode,salePriceMinor,physical,reserved,available,stockValueMinor?}],total,page,pageSize}; pageSize 1..100, q <=128, стабильный порядок name,id.
- browser-security: validateOrigin(origin:string|undefined):void; csrfFor(token:string):string через HMAC с отдельной purpose-меткой. Login проверяет Origin; изменения с cookie также проверяют x-csrf-token. WEB_ORIGINS содержит явный allowlist; без конфигурации production запуск отклоняется. Bearer без cookie сохраняет существующий контракт.

- [x] Написать тесты cookie login/logout, истечения, 403 на отсутствующий/чужой Origin и CSRF; bearer-регрессия; чужой магазин; пагинация и literal-поиск %, _, ведущих нулей. Проверить `expect(cashierItem).not.toHaveProperty('stockValueMinor')`.
- [x] Запустить `npm run test:e2e -- --runTestsByPath test/web-auth.e2e-spec.ts test/catalog-list.e2e-spec.ts` из apps/api; ожидаются FAIL новых маршрутов.
- [x] Реализовать указанные интерфейсы. Расширить UserRequest способом аутентификации и token; не выводить cookie в логи. Поиск параметризованный, wildcards экранируются.
- [x] Повторить команду; PASS всех новых тестов и `npm test` корня — прежних 40 проверок.
- [x] Коммит `feat: add browser sessions and scoped catalog listing`.

### Task 2: Смена и денежный итог

**Files:** Create apps/api/src/migrations/1760000000004-Pos.ts, apps/api/src/pos/{pos.types,shifts.service,shifts.controller}.ts.
Modify apps/api/src/{database,app}.ts.
Test apps/api/test/shifts.e2e-spec.ts.

**Interfaces:**
- ShiftView={id,shopId,actorId,status:'open'|'closed',openingCashMinor,expectedCashMinor,actualCashMinor:number|null,discrepancyMinor:number|null,comment:string|null,openedAt,closedAt:string|null}.
- POST /shops/:shopId/pos/shifts {openingCashMinor} -> ShiftView.
- GET .../pos/shifts/current -> ShiftView|null; чужая активная смена возвращается как {occupied:true}, без финансовых полей.
- GET .../pos/shifts/:id -> ShiftView; владелец или автор смены.
- POST .../pos/shifts/:id/close {actualCashMinor,comment?} -> ShiftView.
- ShiftsService.lockOpen(tx:EntityManager,shopId:string,shiftId:string,actorId:string):Promise<ShiftView>.
- Таблицы cash_registers (shop_id UNIQUE), cash_shifts (composite shop/id FK, partial UNIQUE register WHERE closed_at IS NULL), pos_sales (shop,document,shift), payment_records (shop,document,shift,actor,kind sale|refund,method cash|card,amount_minor). Все ссылки проверяют магазин; платежные записи неизменяемы. Таблицы касс создаются для существующих магазинов; ensure-register через INSERT ON CONFLICT поддерживает новые.

- [x] Написать тесты: `expect(openResults.filter(r=>r.status===201)).toHaveLength(1)`; повтор ключа не открывает вторую смену; cashier не читает чужой отчёт; owner закрывает чужую смену только с комментарием; actual 900 и expected 1000 дают discrepancy -100.
- [x] Запустить `npm run test:e2e -- --runTestsByPath test/shifts.e2e-spec.ts` в apps/api; FAIL.
- [x] Реализовать миграцию и сервисы; ограничить деньги MAX_SAFE_INTEGER. Блокировать смену при закрытии, считать ожидаемые деньги из payment_records, отклонять переполнение. Комментарий при расхождении обязателен, длина 1..500 после trim.
- [x] Повторить тест; PASS. Повторно выполнить миграции на тестовой базе; без изменений старых документов.
- [x] Коммит `feat: add cash shifts and payment ledger`.

### Task 3: Атомарная кассовая продажа и история

**Files:** Modify apps/api/src/pos/sales.service.ts.
Create apps/api/src/pos/{pos-sales.service,pos-sales.controller,sales-history.service}.ts.
Modify apps/api/src/app.ts.
Test apps/api/test/pos-sales.e2e-spec.ts.

**Interfaces:**
- SalesService.postInTransaction(tx,shopId,actorId,normalizedLines:SaleLine[]):Promise<SaleResult>; существующий sell нормализует и вызывает этот метод внутри IdempotencyService.
- POST /shops/:shopId/pos/sales {shiftId,method:'cash'|'card',lines:SaleLine[]} -> {id,kind:'sale',totalMinor,shiftId,method}.
- GET .../pos/sales?page=1&pageSize=25 -> {items:[{id,totalMinor,createdAt,shiftId:string|null,method:string|null}],total,page,pageSize}.
- GET .../pos/sales/:id -> SaleDetail={id,totalMinor,createdAt,shiftId,method,lines:[{id,variantId,name,barcode,quantity,returnedQuantity,unitPriceMinor}]}; owner читает магазин, остальные — свои продажи. Без cost_minor.
- Не более 100 уникальных строк; количество 1..1e9, деньги MAX_SAFE_INTEGER. GET истории возвращает returnedQuantity=0 до добавления возвратов.

- [x] Написать тесты приход10/продажа2/остаток8; cash увеличивает ожидаемые деньги, card нет; повтор даёт один payment; закрытая/чужая смена 409/403. Внести ошибку после stock-записи: `expect(await countPayments()).toBe(0)`, остаток прежний. Конкурентная продажа последней единицы и гонка закрытия не создают платежей после closed_at.
- [x] Запустить `npm run test:e2e -- --runTestsByPath test/pos-sales.e2e-spec.ts test/sales.e2e-spec.ts`; FAIL новых кассовых тестов.
- [x] Выделить только транзакционное ядро SalesService, не менять старые DTO. Новая операция: idempotency → смена FOR UPDATE → остатки в UUID-порядке → документ/строки → связь/платёж; всё на одном соединении.
- [x] Повторить команду; PASS; затем тесты смен.
- [x] Коммит `feat: post POS sales with atomic payments and history`.

### Task 4: Возвраты с исторической себестоимостью

**Files:** Create apps/api/src/migrations/1760000000005-Returns.ts, apps/api/src/pos/{returns.service,returns.controller}.ts.
Modify apps/api/src/pos/{pos.types,sales-history.service}.ts, apps/api/src/{database,app}.ts.
Test apps/api/test/returns.e2e-spec.ts.

**Interfaces:**
- POST /shops/:shopId/pos/returns {saleId,shiftId?,method?:'cash'|'card',refundMoney:boolean,reason,lines:[{saleLineId,quantity,condition:'resellable'|'defective'}]} -> {id,kind:'return',totalMinor,refundedMinor}.
- ReturnsService.return(shopId,actorId,key,input):Promise<ReturnResult>.
- Только owner. refundMoney=true требует shiftId+method и исходную pos_sales/payment запись; false не принимает платёжные поля. Legacy-продажи допускают только false.
- Новые return_documents/return_lines сохраняют исходные FK, condition, цену, восстановленную стоимость, актёра и reason 1..500. stock_documents допускает return. Годные строки создают положительное движение; defective сохраняется в return_lines без доступного stock-движения.

- [x] Написать тесты: продано2, возврат1 -> returnedQuantity1/остаток9; второй возврат2 ->409. Два конкурентных возврата последней единицы дают один успех. После нового прихода восстанавливается прежняя себестоимость. Для cost=100, qty=3 последовательные возвраты1 дают стоимость33,34,33; дефект возвращает деньги, но не доступный запас. Legacy refundMoney=true ->409; cashier/manager ->403.
- [x] Запустить `npm run test:e2e -- --runTestsByPath test/returns.e2e-spec.ts`; FAIL.
- [x] Реализовать порядок блокировок: idempotency → смена при выплате → sale_lines по id → stock по variantId. Возвращённое количество считать по всем состояниям товара. Стоимость очередной части = halfUp(C*(r+q)/Q) − halfUp(C*r/Q), bigint. Проверять итоговую стоимость/количество на overflow. Обновить returnedQuantity в истории.
- [x] Повторить тест; PASS. Проверить rollback платежа, возврата и остатка при ошибке.
- [x] Коммит `feat: add scoped returns with historical cost recovery`.

### Task 5: Кабинет, вход и каталог

**Files:** Create apps/web/package.json, index.html, tsconfig.json, vite.config.ts, src/{main.tsx,App.tsx,styles.css}, src/api/{client,types}.ts, src/auth/{SessionProvider,LoginPage}.tsx, src/catalog/{CatalogPage,CreateVariantPage}.tsx, src/layout/SellerLayout.tsx.
Modify package.json, package-lock.json.
Test apps/web/src/{auth/LoginPage,catalog/CatalogPage}.test.tsx.

**Interfaces:**
- api<T>(path:string,options?:{method?:string,body?:unknown,key?:string}):Promise<T>; cookie credentials, CSRF header, ApiError={status,message,details}; prefix /api.
- useSession() -> {user:Me|null,shopId:string|null,selectShop(id),refresh(),logout()}; выбор только разрешённого магазина.
- Маршруты /seller/login, /seller, /seller/:shopId/products, /seller/:shopId/products/new; корень / не перенаправляет покупателя в учёт.
- Vite proxy /api -> localhost:3001 с удалением префикса. Корневые build/typecheck/test включают web; dev:web отдельный.

- [x] Написать тесты: login выводит безопасную ошибку401; cashier не видит создание/закупочную стоимость; чужой shopId из URL не открывается; creation вызывает только variant endpoint, без receiving.
- [x] Запустить `npm run test --workspace apps/web`; FAIL до реализации компонентов.
- [x] Создать workspace и реализовать интерфейсы, загрузки/пустые состояния/ошибки, подписанные поля и фокус. Денежный helper parseSom(input:string):number принимает 0..2 десятичных знака и точку/запятую, без exponent/отрицательных значений; formatSom(minor:number):string.
- [x] Повторить тест; PASS; проверить parseSom('150,25')=15025, запрет '1e3' и overflow.
- [x] Коммит `feat: add seller login and inventory catalog UI`.

### Task 6: Сканирование и безопасное проведение

**Files:** Create apps/web/src/scanner/{ScanField.tsx,scan-queue.ts}, src/drafts/{draft-store,document-state}.ts, src/receiving/ReceivingPage.tsx, src/pos/SalePage.tsx.
Modify src/App.tsx, src/layout/SellerLayout.tsx.
Test src/scanner/scan-queue.test.ts, src/drafts/document-state.test.ts, src/pos/SalePage.test.tsx.

**Interfaces:**
- createScanQueue(lookup:(code:string)=>Promise<Variant>,onVariant:(v:Variant)=>void,onError:(e:unknown)=>void) -> {enqueue(code:string):void,dispose():void}; dispose отбрасывает результат старого контекста.
- DraftScope={userId,shopId,kind:'receiving'|'sale'|'return'|'shift-open'|'shift-close'}.
- Draft={version:1,scope,revision:string,lines,submission:null|{key,body,status:'pending'|'unknown'}}.
- draft-store: load(scope):Draft|null, save(draft):void, clear(scope,expectedRevision):void, clearUser(userId):void. Ошибка сохранения возвращается вызывающему коду.
- submitDocument(draft,send):Promise<Result> сохраняет pending до fetch; unknown сохраняет неизменное тело/ключ. Успех очищает только совпадающую revision; ошибки400/403/404/409 с подтверждённым откатом разблокируют редактирование. Timeout/5xx/401 оставляют unknown; 401 требует входа тем же сотрудником.
- Приёмка использует старый endpoint; продажа только /pos/sales с собственной открытой сменой.

- [x] Написать тесты: 3 Enter кода '001234' -> qty3, медленные lookup в порядке, ошибка неизвестного кода не останавливает следующий скан; dispose не добавляет старый результат. Потерянный ответ повторяет прежний key/body; reload сохраняет pending; другой сотрудник не видит его.
- [x] Добавить тесты двух окон с одинаковым pending (один key), несовпадающей revision при clear, испорченного JSON и quota exceeded; `expect(send).not.toHaveBeenCalled()` при ошибке сохранения.
- [x] Запустить web test; FAIL.
- [x] Реализовать очередь и явное поле Enter без глобального перехвата клавиатуры. Синхронизировать черновики через storage event; при конфликте revision запретить отправку до reload. Проверять строки, лимиты и стоимость в receiving до сохранения; сохранение отдельно от проведения.
- [x] Повторить web test; PASS. Проверить обновление цены409 требует явного подтверждения и нового ключа, наличие сети само не отправляет документ.
- [x] Коммит `feat: add scanner workflows and recoverable document drafts`.

### Task 7: Смены, возвраты, сквозная проверка и поставка

**Files:** Create apps/web/src/pos/{ShiftPage,SalesHistoryPage,ReturnPage}.tsx, apps/web/e2e/seller.spec.ts, apps/web/playwright.config.ts, docs/api-pos.md, docs/seller-guide.md.
Modify apps/web/src/{App.tsx,styles.css}, Dockerfile, compose.yaml, .github/workflows/ci.yml, README.md, docs/implementation-status.md, apps/api/src/app.ts.

**Interfaces:**
- Маршруты /seller/:shopId/{receiving,pos,shift,sales,sales/:saleId/return}.
- ShiftPage показывает активную/занятую смену и итог cash/card/возвратов; формы open/close используют pending-механизм задачи6.
- ReturnPage работает со снимком SaleDetail, ограничивает количество, требует причину/condition, refundMoney; legacy показывает только товарный возврат.
- Production Nest раздаёт Vite build; /api/* маршрутизируется к API, прямые старые API остаются доступны. /seller/* получает SPA index; неизвестный API не получает HTML. Неавторизованные кабинетные страницы noindex. / получает нейтральную страницу проекта до публичного этапа.

- [x] Написать browser e2e с отдельной *_test БД: login → create → receive10 → open10000 → cash sale2 по15000 → resellable return1 cash → close25000; остаток9 и discrepancy0. Проверить reload draft, logout очистку, offline блокировку и повтор после искусственной потери ответа.
- [x] Написать проверки клавиатуры и отсутствия горизонтального переполнения на 360/768/1440; проверку cashier страницы без себестоимости и owner-only возврата.
- [x] Запустить `npm run test:e2e --workspace apps/web`; FAIL.
- [x] Реализовать страницы, поставку статики и docs. Обновить Docker workspace COPY/npm ci и build; обеспечить запуск API smoke и браузерного smoke против собранного image в CI.
- [x] Выполнить `npm run format:check`, `npm run typecheck`, `npm run build`, `npm test`, `npm run test:e2e --workspace apps/web`, Docker build и существующий scripts/smoke.cjs. PASS; документировать фактические результаты и недоступные аппаратные проверки.
- [x] Коммит `feat: complete seller POS workflows and delivery checks`.
- [x] Выполнить независимое ревью всей ветки согласно выбранному пользователем способу исполнения; устранить подтверждённые дефекты и повторить затронутые проверки.
- [x] Создать PR feat/seller-pos → main с результатами и ограничением: физическое оборудование и фискальная интеграция ещё не проверены. Не сливать PR без отдельного указания.

## Результат самопроверки плана

Каждый раздел утверждённого spec покрыт задачами: права/сессия/каталог1, смены2, продажи3, возвраты4, интерфейс5–7, сканер/черновики6, проверки/поставка7.
Все пять Review Focus получили проверки. Общие типы и путь /api согласованы; старые API и 40 тестов сохраняются. Печатать этикетки или создавать публичную витрину этот план не поручает.

## Исполнение

Рекомендуется Native: основной агент выполняет задачи последовательно в этой сессии, затем свежий независимый агент проверяет всю ветку. Это сохраняет контекст тесно связанных интерфейсов.
Альтернатива Subagent-driven: отдельный исполнитель и проверяющий на каждую задачу; больше независимых проверок и расхода контекста.
План утверждён пользователем 7 октября 2026; выбран Native. Выполнение и фактические проверки описаны в docs/stage2-status.md.
