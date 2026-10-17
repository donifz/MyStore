# Отчёт о проверке: адаптивность, отступы, контрастность заливок и доступность кнопок

Дата: 17 октября 2026 года.
Ветка: `feat/ui-accessibility-and-responsive-polish`.
Связанная задача: Часть 7 дорожной карты релиза ([2026-10-17-release-scope.md](../implementation/2026-10-17-release-scope.md)).
Запрос пользователя: «посмотри все паддинги отступвы маржины прилипшие кнопки и заливки которыу не видгы тексты».

## 1. Объём проведённого аудита и реализации

1. **Прилипшие кнопки, обёртки и отсутствие переноса (`flex-wrap`)**:
   - `apps/web/src/pos/ShiftPage.tsx`:
     - Кнопки операций смены «+ Внесение наличных» и «− Изъятие наличных»: добавлен `flexWrap: 'wrap'` и гарантированный отступ `margin: 1.25rem 0`, исключающий горизонтальное выпирание и прилипание к границам экрана на узких смартфонах (320px / 360px / 390px).
     - Модальные окна внесения/изъятия: контейнер кнопок «Подтвердить» и «Отмена» дополнен `flexWrap: 'wrap'`.
   - `apps/web/src/platform/AdminPage.tsx`:
     - Модальные окна блокировки маркетплейса и управления подпиской: контейнеры кнопок («Подтвердить блокировку», «Сохранить», «Снять ограничение», «Отмена») дополнены `flexWrap: 'wrap'` и `gap: 0.5rem`.
     - Таблицы действий администратора: для `.admin-kit-actions button` обеспечена минимальная высота 36px (с переходом к полноразмерным touch-target 40px+ на мобильных устройствах).
   - `apps/web/src/pos/SaleDetailPage.tsx`:
     - Кнопка «Оформить возврат» обёрнута в отдельный блок `.actions` с отступом `marginTop: 1.25rem`, исключающий прилипание к крупному блоку итоговой суммы чека (`.total`).

2. **Заливки и контрастность текстов (WCAG AA Contrast ≥ 4.5:1 / 5.0:1)**:
   - В `apps/web/src/styles.css`:
     - `.stock.empty`: обновлено с малоконтрастного серого (`#8e98a4` на `#f5f6f8` с контрастом 2.5:1) на чёткий глубокий тон `color: #475467; background: #f0f3f6; font-weight: 500;` (контраст > 5.5:1).
     - `.status-pill.status-archived`: улучшен до `color: #444a51; background: #edf0f2; font-weight: 500;` (контраст > 7:1).
     - `.status-pill.status-active`: улучшен до `color: #155734; background: #def4e6; font-weight: 600;` (контраст > 6:1).
     - `.admin-kit-status`: янтарный статус обновлён с `#94630d` (3.8:1) на контрастный насыщенный `color: #734800; background: #fff3dc; font-weight: 600;` (контраст > 5.5:1).
     - `.admin-kit-status.green`: обновлён на `color: #165635; background: #def4e6; font-weight: 600;` (контраст > 6:1).
     - `.admin-kit-status.red`: обновлён на `color: #942525; background: #fbe6e6; font-weight: 600;` (контраст > 6:1).
     - `.admin-kit-status.neutral`: обновлён на `color: #454f53; background: #edf0f1; font-weight: 500;` (контраст > 7:1).
     - `.admin-kit-actions .admin-kit-approve`: `color: #165936; background: #e7f6ee; border-color: #b7e3ce; font-weight: 600;`.
     - `.admin-kit-actions .admin-kit-reject`: `color: #8e2b2b; background: #fff4f4; border-color: #f2caca; font-weight: 600;`.
     - `.empty-state`: обновлён с `#8290a0` на `color: #556374;`.
     - `.eyebrow`: обновлён с `#718093` на `color: #4b5868; font-weight: 600;`.
     - `.muted`: обновлён с `#778394` на `color: #556272;`.
     - `.code`: обновлён с `#8290a0` на `color: #5c6978;`.
     - `th`: обновлён с `#718093` на `color: #4c5867; font-weight: 600;`.
     - `.notice`: обновлён на `color: #3b5068; background: #edf3fa; border: 1px solid #cddbee; font-weight: 500;`.
     - `.error`: обновлён на `color: #991b1b; background: #fef2f2; border: 1px solid #fecaca; font-weight: 500;`.
     - `.success`: обновлён на `color: #165936; background: #edf7f1; border: 1px solid #c0e6ce; font-weight: 500;`.
   - В `apps/storefront/styles/tokens.css` и `apps/storefront/styles/storefront.css`:
     - `--sf-muted`: `#475569` (был `#5b6b7d`) для лучшей читаемости подсказок и дополнительной информации.
     - `--sf-primary-dark`: `#00523d` для высококонтрастного текста на мягких зелёных подложках (`--sf-primary-soft: #eaf5f0`).
     - `.sf-badge--neutral`: `color: #334155; background: var(--sf-background); font-weight: 500;`.
     - `.sf-badge--success`: `color: var(--sf-primary-dark); background: var(--sf-primary-soft); font-weight: 600;`.
     - `.sf-badge--warning`: `color: #78350f; background: var(--sf-warning-soft); font-weight: 600;`.
     - `.sf-badge--danger`: `color: #991b1b; background: var(--sf-danger-soft); font-weight: 600;`.
     - `.sf-alert--info`, `.sf-alert--success`: `color: var(--sf-primary-dark); font-weight: 500;`.
     - `.sf-alert--error`: `color: #991b1b; font-weight: 500;`.

3. **Сетки и отступы на узких экранах (320px / 360px / 390px)**:
   - В `apps/storefront/styles/storefront.css` добавлено медиа-правило `@media (max-width: 380px)`:
     - Уменьшены боковые отступы контейнера: `.sf-container { padding-inline: 12px; }` для сохранения полезной ширины карточек.
     - Фильтры каталога `.sf-catalog-sidebar .sf-filters` перестроены в 1 колонку (`grid-template-columns: 1fr`) вместо сжатия в 2 тесные 130px-колонки.
     - Поиск магазинов `.sf-shop-search` перестроен в 1 колонку.
     - Сетки товаров `.sf-product-grid` адаптированы с зазором `gap: 8px` и компактными отступами карточки `padding: 4px`.
   - В `apps/web/e2e/admin-consistency.spec.ts`:
     - Расширен тестовый матричный диапазон ширин: `[320, 360, 390, 768, 1024, 1440]` для всех 15 seller-экранов и главной админки `/seller`.
   - В `apps/web/src/styles.css` (платформенная панель администратора):
     - `.admin-kit-heading h1`: добавлен перенос длинных составных слов (`overflow-wrap: anywhere; word-break: break-word;`) и медиа-масштабирование (24px при <= 820px, 20px при <= 480px, 18px при <= 380px), предотвращающее горизонтальное распирание заголовком «Администрирование MyStore» (слово из 17 кириллических букв) на экранах 320px.
     - `.admin-kit-search`: добавлен `min-width: 0; max-width: 100%;`, а для вложенного `<input>` — `min-width: 0; flex: 1; width: 100%;`.
     - `.admin-kit-card`, `.admin-kit-card-head`: добавлены `min-width: 0; max-width: 100%; overflow: clip; flex-wrap: wrap;` и перенос текста.
     - `.admin-kit-scroll`: обеспечена изоляция горизонтальной прокрутки таблиц (`min-width: 0; max-width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;`).
     - `.admin-kit-date`: компактные отступы `padding: 6px 10px; font-size: 12px;` на экранах <= 380px.

## 2. Результаты проверок

1. **Storefront Playwright Browser Suite (`npx playwright test` в `apps/storefront`)**:
   - Все 18 тестов успешно пройдены (включая каталоги и корзины на 320px, 390px, 768px, 1440px).
2. **Web Vitest Suite (`npm test --workspace=@mystore/web`)**:
   - Все 21 тестовый файл и 84 теста пройдены без ошибок.
3. **Server-rendered SSR Checks (`node scripts/storefront-ssr-test.cjs`)**:
   - Все проверки (HTML, метатеги, JSON-LD, sitemap, robots) пройдены.
4. **Статическая типизация (`npm run typecheck`)**:
   - Пройдена без ошибок по всем воркспейсам.
5. **Форматирование кода (`npm run format:check`)**:
   - 100% соответствие стилю Prettier.
