# Отчёт о проверке: управленческие отчёты и платформа (блокировка витрины, подписка)

Дата: 17 октября 2026 года.
Ветка: `feat/reports-and-platform-management`.
Связанная задача: Часть 6 дорожной карты релиза ([2026-10-17-release-scope.md](../implementation/2026-10-17-release-scope.md)).
Дизайн-спецификация: [2026-10-17-reports-and-platform-management-design.md](../superpowers/specs/2026-10-17-reports-and-platform-management-design.md).

## 1. Объём реализации

1. **База данных и миграции**:
   - Миграция `1760000000023-ReportsAndPlatformManagement.ts`:
     - Добавлена колонка `issued_at timestamptz NULL` в таблицу `online_orders` с обратной совместимостью (`UPDATE online_orders SET issued_at = updated_at WHERE status = 'issued' AND issued_at IS NULL`). Добавлен индекс на `(shop_id, issued_at)`.
     - Добавлены колонки в таблицу `shops`:
       - `marketplace_blocked boolean NOT NULL DEFAULT false` (индекс на `marketplace_blocked`),
       - `marketplace_block_reason text NULL`,
       - `subscription_until timestamptz NULL`.
     - Зарегистрирована в `apps/api/src/database.ts`.

2. **Онлайн-заказы и фиксация времени выдачи**:
   - В `OrdersService`:
     - При выдаче заказа (`issueOrder`) фиксируется точное время физической выдачи: `issued_at = now()`.
     - При оформлении заказа через маркетплейс (`checkout`) выполняется валидация статуса магазина: если `marketplace_blocked = true`, операция немедленно блокируется (`403 Forbidden`: «Приём онлайн-заказов временно приостановлен администрацией маркетплейса»).

3. **Фильтрация витрины маркетплейса**:
   - В `StorefrontService`:
     - Заблокированные магазины исключаются из списка магазинов маркетплейса (`stores`).
     - Страница заблокированного магазина (`store`) и его товары (`products`, `product`) возвращают `404 Not Found`.
     - Заблокированные магазины и их товары исключаются из фильтров каталога и поисковой выдачи (`filters`, `products`).

4. **Финансовые отчёты и разделение каналов**:
   - В `ReportsService`:
     - Выданные онлайн-заказы попадают в отчётность по дате фактической выдачи (`COALESCE(issued_at, updated_at)`), а не по дате первоначального создания заказа.
     - `summary` возвращает раздельные финансовые метрики каналов:
       - `posSalesMinor`, `posSalesCount` (продажи через кассу в торговой точке),
       - `onlineSalesMinor`, `onlineSalesCount` (выданные интернет-заказы),
       - `returnsCount` (количество возвратов),
       - Поддерживается фильтрация по произвольному диапазону дат (`from`, `to`).
     - Экспорт продаж `sales.csv` содержит колонку `channel` (`pos` / `online`).
     - Экспорт заказов `orders.csv` содержит колонку `issued_at`.

5. **Администрирование платформы (подписки и доступ к маркетплейсу)**:
   - В `PlatformAdminService` и `AdminSessionController`:
     - `setMarketplaceBlocked(adminId, shopId, blocked, reason)`: ручная блокировка/разблокировка витрины маркетплейса с фиксацией обязательной причины и записью в `audit_log` (`action: marketplace:block` / `marketplace:unblock`).
     - `setSubscription(adminId, shopId, until)`: ручная установка или продление даты подписки магазина с фиксацией в `audit_log` (`action: subscription:update`).
     - `overview()`: расширен возвратом полей `marketplaceBlocked`, `marketplaceBlockReason`, `subscriptionUntil` для каждого магазина.
     - Эндпоинты:
       - `POST /platform/admin/shops/:shopId/marketplace-status`
       - `POST /platform/admin/shops/:shopId/subscription`
     - Сохранение кассовой и учётной автономности: блокировка витрины блокирует только публичный маркетплейс и приём новых онлайн-заказов; вход в кабинет продавца, складской учёт, чеки, возвраты, смены и кассовые операции в магазине работают без ограничений.

6. **Интерфейс продавца и администратора (`apps/web`)**:
   - `ReportsPage.tsx`:
     - Добавлен фильтр диапазона дат с быстрыми кнопками (Сегодня, Неделя, Месяц, Год, Всё время) и кастомными полями `from` / `to`.
     - Разделение выручки по каналам: карточки «Касса (POS)» и «Онлайн-заказы» с суммами и количеством операций.
     - Сохранение параметров фильтра и корректное скачивание CSV-выгрузок с учётом выбранного диапазона дат.
   - `AdminPage.tsx`:
     - В таблице магазинов добавлены колонки «Витрина» (активна / заблокирована) и «Подписка» (дата окончания или бессрочно).
     - Действия: модальное окно блокировки витрины (с обязательным указанием причины) / разблокировки, модальное окно установки/продления срока подписки.
     - Полная адаптивность (touch-target ≥ 44px, корректная сетка на 320/390/768/1024/1440).

## 2. Результаты проверок

1. **Новый E2E-сьют (`apps/api/test/reports-and-platform-management.e2e-spec.ts`)**:
   - `order issued_at timing, channel separation in financial reports and exports`: **PASS** (проверено: онлайн-заказ попадает в отчёт только после выдачи, разделение каналов `posSalesMinor` vs `onlineSalesMinor`, колонки в `sales.csv` и `orders.csv`).
   - `marketplace blocking hides shop and products, rejects online orders, but preserves POS and seller access`: **PASS** (проверено: блокировка скрывает магазин из публичного каталога, новые заказы блокируются с 403, при этом касса POS, открытие смены и продажи работают штатно, после разблокировки магазин снова доступен).
   - `manual subscription management and audit logging`: **PASS** (проверено: установка даты подписки, сброс подписки, аудит-лог).

2. **Регрессионный прогон E2E-тестов API (`npm run test:e2e --workspace=@mystore/api`)**:
   - Все тестовые сьюты успешно пройдены.
