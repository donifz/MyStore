# Отчёт о проверке: архив каталога и разновидности товаров (размеры и цвета)

Дата: 17 октября 2026 года.
Ветка: `feat/catalog-archive-and-variants`.
Связанная задача: Часть 4 дорожной карты релиза ([2026-10-17-release-scope.md](../implementation/2026-10-17-release-scope.md)).
Дизайн-спецификация: [2026-10-17-archive-and-variants-design.md](../superpowers/specs/2026-10-17-archive-and-variants-design.md).

## 1. Объём реализации

1. **Архивирование товаров**:
   - Миграция `1760000000021-ArchiveAndVariants.ts`:
     - Добавлена колонка `archived boolean NOT NULL DEFAULT false` в таблицу `variants`.
     - Добавлен индекс `variants_shop_archived_idx` на `(shop_id, archived)`.
   - **Защитный барьер активных резервов**:
     - В `VariantsService.archiveVariant` проверяется `stock_balances.reserved > 0`. Если у товара есть активные резервы покупателей в онлайн-заказах, операция немедленно отклоняется с `409 Conflict` («Cannot archive variant with active reservations»).
   - **Блокировка операций со складом и продажами**:
     - Приёмка (`ReceivingService.receive`): отклоняется с `409 Conflict` при попытке оприходовать архивированный товар.
     - Продажа в POS (`SalesService.sell`): отклоняется с `409 Conflict` («Cannot sell archived variant»).
     - Онлайн-заказ (`OrdersService.createOrder`): возвращает `404 Not Found` («Product unavailable»).
     - Добавление потомка к архивированному товару: отклоняется с `409 Conflict`.
   - **Сохранение исторических возвратов**:
     - Возврат (`ReturnsService.returnSale`) ранее проданного товара выполняется напрямую по строкам чека и партиям без требования разархивации карточки.
   - **Аудит**:
     - При архивации записывается событие `action: 'archived'` в `audit_log`.
     - При разархивации записывается событие `action: 'unarchived'` в `audit_log`.

2. **Разновидности товаров (группы вариантов: размеры и цвета)**:
   - Миграция: добавлена колонка `parent_id uuid REFERENCES variants(id) ON DELETE SET NULL` и индекс `variants_parent_id_idx`.
   - Полная финансовая независимость:
     - У каждой разновидности — собственный уникальный `barcode`, `sku`, `sale_price_minor`, партионный учёт и остатки на складе. Никаких усреднений или смешивания себестоимости.
   - Эндпоинт группы вариантов: `GET /shops/:shopId/variants/:variantId/variants` возвращает весь состав группы (корневой товар и дочерние варианты) с актуальными остатками.
   - Витрина:
     - `GET /public/stores/:slug/products/:id` скрывает архивированные товары и возвращает массив активных `variants` для переключения размеров и цветов.
     - Интерактивный компонент `VariantSelector.tsx` на странице товара (`/shops/[slug]/products/[id]`) позволяет покупателю выбирать размер/цвет с динамическим обновлением цены, остатка и артикула с соблюдением минимального размера кликабельных зон ≥ 44 px.

3. **Интерфейс продавца (`apps/web`)**:
   - `CatalogPage.tsx`: переключатель вкладок «Активные» / «В архиве», значки статусов и размеров/цветов в строке таблицы.
   - `EditVariantPage.tsx`:
     - Бейдж текущего статуса («Активен» / «В архиве»).
     - Кнопка архивации/разархивации с понятным предупреждением и обработкой блокировки при резервах.
     - Таблица разновидностей группы с возможностью перехода в любую карточку и кнопкой «+ Добавить размер / цвет».
   - `CreateVariantPage.tsx` и `ProductForm.tsx`: поддержка параметра `parentId` при создании нового размера/цвета.

## 2. Результаты испытаний

1. **Новый интеграционный E2E-сьют (`apps/api/test/variants-archive-groups.e2e-spec.ts`)**:
   - `creates root and child variants with independent barcodes and prices`: **PASS**.
   - `cannot archive variant with active reservations`: **PASS** (проверено: попытка архивации при активном заказе блокируется с 409, после отмены заказа успешно проходит с записью в аудит).
   - `blocks receiving and POS sales on archived variant`: **PASS** (проверено: приёмка, продажа и добавление потомка блокируются с 409).
   - `preserves historical returns on variant after it is archived`: **PASS** (проверено: возврат проданного товара после архивации оформляется успешно, баланс корректно восстанавливается).
   - `unarchive variant restores availability and logs audit event`: **PASS** (проверено: разархивированный товар возвращается в активный список и снова доступен к приёмке).
   - `storefront hides archived variants and returns linked variants for active product`: **PASS** (проверено: витрина возвращает группу активных вариантов и скрывает архивированные).

2. **Полный регрессионный прогон E2E тестов API (`npm run test:e2e --workspace=@mystore/api`)**:
   - 40 тестовых сьютов из 40 успешно пройдены (243 теста).

3. **Тесты панели продавца (`npm test --workspace=@mystore/web`)**:
   - 21 тестовый сьют из 21 успешно пройден (83 теста).

4. **Проверка типов и сборка**:
   - `npm run typecheck --workspace=@mystore/api`: 0 ошибок.
   - `npm run typecheck --workspace=@mystore/web`: 0 ошибок.
   - `npm run typecheck --workspace=@mystore/storefront`: 0 ошибок.
   - `npm run build --workspace=@mystore/storefront`: Next.js production build успешен.
   - `npm run format:check`: 100% файлов соответствуют стандарту Prettier.
