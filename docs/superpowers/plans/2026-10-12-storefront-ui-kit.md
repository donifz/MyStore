# Storefront UI-kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Внедрить согласованный светлый UI-kit с зелёным акцентом, шаблоны storefront и обязательные правила дальнейшей работы.

**Architecture:** CSS-токены и небольшие React-компоненты принадлежат apps/storefront. Серверные страницы сохраняют загрузку данных и metadata; клиентские бизнес-компоненты сохраняют корзину, запросы и восстановление заказа. /ui-kit показывает компоненты на локальных демонстрационных данных.

**Tech Stack:** Существующие Next.js App Router, React, TypeScript, CSS, Prettier и Playwright.

**Spec:** docs/superpowers/specs/2026-10-12-storefront-ui-kit-design.md

## Global Constraints

- Рабочая ветка: codex/storefront-ui-kit; не изменять main напрямую.
- Node.js >=24.15 <25, как требует корневой package.json.
- Не добавлять UI-библиотеки, Storybook или внешний шрифт.
- CSS custom properties --sf-*; классы sf-*.
- Цвета, отступы, радиусы и размеры строго из спецификации.
- Сетка товаров: 2 колонки до 768 px, 3 от 768 px, 4 от 1100 px.
- Данные Product/Store и форматирование formatSom из lib/public-api.ts.
- Сохранить маршруты, metadata, JSON-LD, GET-фильтры и пагинацию.
- Сохранить бизнес-логику CartProvider, BuyButton, Checkout, PartnerForm и PartnerActivation.
- Учитывать корневой AGENTS.md: форматирование, typecheck, build, релевантные тесты, Playwright и GitHub Actions.

## Review Focus

1. Длинное название без пробелов на 320 px: не вызывает горизонтальный скролл — Task 2/4.
2. Телефон отсутствует: не появляется нерабочая tel-ссылка — Task 2/4.
3. Неизвестный результат оформления: повторное действие блокируется до проверки заказа — Task 3/4.
4. GET-параметры поиска при переходе на следующую страницу сохраняются — Task 2/4.
5. loading/disabled кнопки внутри формы не запускают повторное действие — Task 1/4.

## File Structure

- Create apps/storefront/styles/tokens.css и storefront.css.
- Create apps/storefront/components/ui/{Button,LinkButton,Input,Select,Textarea,Checkbox,Badge,Alert,EmptyState,Skeleton}.tsx и index.ts.
- Create apps/storefront/components/storefront/{Header,Footer,ProductCard,StoreCard,CatalogFilters,Price,StockBadge}.tsx.
- Create apps/storefront/components/UiKitExamples.tsx и app/ui-kit/page.tsx.
- Modify существующие layout, страницы, Catalog, Pagination, BuyButton, Checkout, PartnerForm, PartnerActivation.
- Create apps/storefront/AGENTS.md и docs/ui-kit.md.
- Create apps/storefront/playwright.config.ts, e2e/ui-kit.spec.ts, e2e/storefront.spec.ts и e2e/fixture-server.cjs.
- Modify scripts/storefront-ssr-test.cjs только если семантические селекторы требуют обновления; сохранить проверки безопасности и фильтров.

### Task 1: Токены, доступные элементы и демонстрационная страница

**Interfaces:** Button(props: native button props & {variant?: 'primary'|'secondary'|'ghost'|'danger'; size?: 'sm'|'md'|'lg'; loading?: boolean}) и LinkButton с Next Link props. Поля принимают native props + {id: string; label: string; hint?: string; error?: string}. Остальные контракты — из спецификации. Все возвращают React-элементы.

- [ ] Подготовить рабочую копию существующей ветки через using-git-worktrees; проверить статус, корневой AGENTS.md и установленный Node.js. Не перезаписывать чужие файлы.
- [ ] Создать e2e/ui-kit.spec.ts: проверить /ui-kit, accessible labels, aria-describedby/aria-invalid, кнопку type=button внутри формы и блокировку loading/disabled.
- [ ] Добавить playwright.config.ts: testDir=e2e, baseURL=http://127.0.0.1:3000, workers=1, webServer запускает существующий npm run dev --workspace apps/storefront. Использовать уже установленный @playwright/test.
- [ ] Запустить из apps/storefront: npx playwright test e2e/ui-kit.spec.ts. Ожидать отказ из-за отсутствующего /ui-kit.
- [ ] Создать токены из спецификации; компоненты и barrel exports. Button по умолчанию type=button; loading устанавливает disabled и aria-busy. Поля связывают подписи и сообщения с id.
- [ ] Создать /ui-kit с metadata robots={index:false,follow:false}; примеры данных фиксированы, действия не отправляют запросы и не меняют корзину.
- [ ] Подключить токены и CSS на странице /ui-kit, пока общий layout ещё использует старые стили; изолировать sf-* от старых глобальных селекторов.
- [ ] Повторить тест: все проверки Task 1 проходят. Отформатировать изменённые файлы проектным Prettier; перед push выполнить npm run format:check.
- [ ] Закоммитить завершённый UI-kit.

### Task 2: Общая оболочка, карточки и серверные страницы

**Interfaces:** Header()/Footer(); ProductCard({product: Product}); StoreCard({store: Store}); Price({minor: number}); StockBadge({available: number}); CatalogFilters({filter: ReturnType<typeof query>; categories: string[]; slug?: string}). ProductCard и StoreCard возвращают одну навигационную ссылку без вложенных интерактивных элементов.

- [ ] Расширить scripts/storefront-ssr-test.cjs проверками: сохранение фильтров в пагинации, товар без фото, товар без телефона, available=0, empty/API failure. Не удалять существующие утверждения.
- [ ] Выполнить node scripts/storefront-ssr-test.cjs после сборки текущей ветки; новые проверки отсутствующих компонентов/состояний должны выявить недостающую реализацию.
- [ ] Создать Header/Footer с существующим CartLink, карточки, Price/StockBadge и CatalogFilters.
- [ ] Обновить Catalog.tsx, Pagination.tsx, app/layout.tsx, app/shops/page.tsx, app/shops/[slug]/products/[id]/page.tsx и app/not-found.tsx.
- [ ] Удалить импорт ../../web/src/styles.css из layout только после покрытия storefront собственными стилями. Перенести нужные стили оставшихся форм в storefront.css, чтобы промежуточный коммит не ломал страницы.
- [ ] Встроить состояние ошибки/пустоты через Alert/EmptyState; при отсутствии телефона пропустить контактную кнопку. Сохранить Refresh, маршруты, metadata и JSON-LD.
- [ ] Выполнить npm run build и node scripts/storefront-ssr-test.cjs; ожидать успешное завершение.
- [ ] Отформатировать, проверить format:check и закоммитить шаблоны каталога/товара.

### Task 3: Корзина, оформление и подключение партнёров

**Interfaces:** Использует UI-компоненты Task 1 и Price Task 2. Публичные интерфейсы и запросы существующих бизнес-компонентов не меняются.

- [ ] Добавить e2e/storefront.spec.ts: оформить тестовый заказ, вызвать неизвестный результат, проверить блокировку изменения количества и повторного submit до восстановления.
- [ ] Создать fixture-server.cjs: локальный HTTP fixture API на 3001, возвращающий Product/Store и управляемые результаты /api/public/orders и /receipt; запуск только в тестах. Next получает SSR API через существующий PORT=3001.
- [ ] Для браузерных запросов использовать Playwright route fixtures; для SSR — fixture-server. Добавить оба сервера в webServer конфигурации, с PORT=3001 у процесса Next; не менять production API.
- [ ] Запустить соответствующий тест и подтвердить, что он проверяет реальный Next storefront.
- [ ] Обновить JSX BuyButton.tsx, Checkout.tsx, PartnerForm.tsx и PartnerActivation.tsx общими компонентами. Сохранить обработчики, recovery, checkoutKey, ref-защиту повторного submit и fieldset disabled.
- [ ] Разметить корзину двумя колонками на desktop и одной на телефоне; показать итог через Price, поля через UI-компоненты, ошибки/успех через Alert.
- [ ] Проверить добавление, количество, подтверждение замены магазина, отправку заявки партнёра, оформление и восстановление заказа.
- [ ] Повторить Playwright и существующие релевантные тесты apps/web; ошибки не маскировать заменой assertions.
- [ ] Отформатировать, проверить format:check и закоммитить формы.

### Task 4: Адаптивность, правила и итоговая проверка

**Interfaces:** Никаких новых runtime-контрактов; документировать фактические props Task 1–3.

- [ ] Добавить Playwright проверки ширин 320, 390, 768, 1440 px: scrollWidth <= clientWidth, корректное число колонок, переходы каталог → магазин → товар → корзина, клавиатурный фокус и длинное название без пробелов.
- [ ] Проверить пустой каталог, API 503, отсутствующие фото/телефон, available=0 и сохранение GET-параметров на следующей странице.
- [ ] Проверить /ui-kit без работающего fixture API, noindex в HTML и отсутствие /ui-kit в sitemap.
- [ ] Исправить наблюдаемые проблемы в компонентах и storefront.css; prefers-reduced-motion отключает декоративные переходы.
- [ ] Создать apps/storefront/AGENTS.md: обязательны токены, общие компоненты, доступные состояния, responsive QA и сохранение серверной/клиентской границы; корневые правила имеют силу.
- [ ] Создать docs/ui-kit.md: импорт компонентов, реальные примеры props, токены и матрица страниц/состояний.
- [ ] Запустить npm run format:check, npm run typecheck, npm run build, node scripts/storefront-ssr-test.cjs, npm run test --workspace apps/web и полный storefront Playwright suite.
- [ ] Просмотреть screenshots каталога, товара, корзины и /ui-kit на телефоне и desktop.
- [ ] Выполнить verification-before-completion и requesting-code-review; устранить замечания до PR.
- [ ] Отправить ветку, создать draft PR и прикрепить его к чату. Проверить GitHub Actions; сообщить точные результаты и ограничения. Не сливать PR и не публиковать сайт.

## Самопроверка плана

Спецификация покрыта Tasks 1–4: токены, primitives, предметные компоненты, страницы, демонстрация, правила и проверки. Review Focus включён в соответствующие тесты. Props используют существующие Product/Store; денежные значения сохраняют minor units. Промежуточное удаление общего CSS отложено до покрытия всех существующих страниц. Fixture API изолирован от production; noindex и sitemap проверяются отдельно.

