import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
for (const width of [320, 390, 768, 1440]) {
  test(`catalog has a usable grid without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?q=long');
    await expect(
      page.getByRole('heading', { name: 'Все товары' }),
    ).toBeVisible();
    const columns = await page
      .locator('.sf-product-grid')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(width >= 1100 ? 4 : width >= 768 ? 3 : 2);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.getByLabel('Поиск', { exact: true })).toBeVisible();
  });
}
test('pagination preserves the selected filters', async ({ page }) => {
  await page.goto('/?q=чашка&category=Посуда&sort=price-asc&inStock=true');
  await page.getByRole('link', { name: 'Следующая страница' }).click();
  await expect(page).toHaveURL(/page=2/);
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe('чашка');
  expect(url.searchParams.get('category')).toBe('Посуда');
  expect(url.searchParams.get('sort')).toBe('price-asc');
  expect(url.searchParams.get('inStock')).toBe('true');
  await expect(
    page.getByRole('heading', { name: 'На этой странице товаров нет' }),
  ).toBeVisible();
});
test('uses canonical shop routes and renders the active seasonal theme', async ({
  page,
}) => {
  await page.goto('/shops/shop-a?category=Посуда');
  await expect(page).toHaveURL(/\/shop\/shop-a\?category=/);
  await expect(
    page.getByRole('heading', { name: 'Нооруз майрамы' }),
  ).toBeVisible();
  await expect(page.locator('.sf-theme--nooruz')).toBeVisible();
});
test('product with no phone has no broken contact link and sold-out product cannot be added', async ({
  page,
}) => {
  await page.goto('/shops/no-phone/products/' + id);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.goto('/shops/shop-a/products/sold-out');
  await expect(
    page.getByRole('button', { name: 'Нет в наличии' }),
  ).toBeDisabled();
});
test('navigation and cart survive mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shops');
  await page.getByRole('link', { name: /Магазин у дома/ }).click();
  await page
    .getByRole('heading', { name: 'Керамическая чашка', exact: true })
    .getByRole('link')
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Корзина', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Ваше имя')).toBeVisible();
  await page.getByLabel('Количество Керамическая чашка').fill('2');
  await expect(page.getByText(/480/).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('an unknown checkout result blocks editing and resubmission until recovery', async ({
  page,
}) => {
  let recover = false;
  const sent: any[] = [];
  await page.route('**/api/public/orders', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      body: '{}',
      contentType: 'application/json',
    });
  });
  await page.route('**/api/public/orders/receipt', (route) =>
    route.fulfill({
      status: recover ? 200 : 503,
      contentType: 'application/json',
      body: recover
        ? JSON.stringify({
            id: 'receipt-1',
            status: 'new',
            totalMinor: 24000,
            expiresAt: null,
            storeName: 'Магазин у дома',
          })
        : '{}',
    }),
  );
  await page.goto('/shops/shop-a/products/' + id);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Результат пока неизвестен',
  );
  await expect(page.getByLabel('Количество Керамическая чашка')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Подтвердить заказы', exact: true }),
  ).toBeDisabled();
  expect(sent).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('Количество Керамическая чашка')).toBeDisabled();
  const pending = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!).attempts[
        'shop-a'
      ],
  );
  expect(pending).toEqual(sent[0]);
  recover = true;
  await page
    .getByRole('button', { name: 'Проверить / повторить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
});
test('empty and failed catalogs provide usable states', async ({ page }) => {
  await page.goto('/?q=empty');
  await expect(
    page.getByRole('heading', { name: 'Ничего не найдено' }),
  ).toBeVisible();
  await page.goto('/?q=outage');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Не удалось загрузить каталог',
  );
  await expect(page.getByRole('link', { name: 'Повторить' })).toBeVisible();
});

test('multi-store checkout preserves successful groups and retries rejected groups independently', async ({
  page,
}) => {
  const requests: any[] = [];
  let acceptSecond = false;
  await page.route('**/api/public/orders', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const rejected = body.storeSlug === 'no-phone' && !acceptSecond;
    await route.fulfill({
      status: rejected ? 409 : 201,
      contentType: 'application/json',
      body: JSON.stringify(
        rejected
          ? { message: 'Insufficient available stock', available: 0 }
          : {
              id: body.storeSlug === 'shop-a' ? 'success-a' : 'success-b',
              status: 'new',
              totalMinor: 24000,
              expiresAt: null,
              storeName:
                body.storeSlug === 'shop-a'
                  ? 'Магазин у дома'
                  : 'Магазин без телефона',
            },
      ),
    });
  });
  await page.goto('/shops/shop-a/products/' + id);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await expect(
    page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('link', { name: /Перейти в корзину/ }),
  ).toBeVisible();
  await page.goto('/shops/no-phone/products/' + secondId);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(2);
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(1);
  await expect(page.locator('.sf-order-receipt')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Изменилось наличие',
  );
  expect(requests.map((r) => r.storeSlug)).toEqual(['shop-a', 'no-phone']);
  expect(requests[0].lines).toEqual([
    { variantId: id, quantity: 1, expectedUnitPriceMinor: 24000 },
  ]);
  expect(requests[1].lines).toEqual([
    { variantId: secondId, quantity: 1, expectedUnitPriceMinor: 24000 },
  ]);
  for (const request of requests)
    expect(request.checkoutKey).toMatch(/^[\da-f-]{36}$/);
  expect(requests[0].checkoutKey).not.toBe(requests[1].checkoutKey);
  acceptSecond = true;
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(0);
  await expect(page.locator('.sf-order-receipt')).toHaveCount(2);
  expect(requests.map((r) => r.storeSlug)).toEqual([
    'shop-a',
    'no-phone',
    'no-phone',
  ]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!).items,
    ),
  ).toEqual([]);
});

test('partner form submits the same data and announces success', async ({
  page,
}) => {
  const shopTypes = [
    { code: 'general', name: 'Универсальный магазин' },
    { code: 'toys', name: 'Игрушки' },
    { code: 'grocery', name: 'Продукты питания' },
    { code: 'fashion', name: 'Одежда и обувь' },
    { code: 'electronics', name: 'Электроника' },
    { code: 'home', name: 'Товары для дома' },
  ];
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/partners/shop-types', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(shopTypes),
    }),
  );
  await page.route('**/api/partners/applications', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/partner');
  await page.getByLabel('Название магазина').fill('Мастерская');
  await page.getByLabel('Email', { exact: true }).fill('example@example.test');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('main')
    .getByLabel('Город', { exact: true })
    .fill('Бишкек');
  const shopTypeSelect = page.getByLabel('Категория бизнеса');
  await expect(shopTypeSelect.locator('option')).toHaveText([
    'Выберите тип магазина',
    ...shopTypes.map((type) => type.name),
  ]);
  await shopTypeSelect.selectOption('home');
  await expect(shopTypeSelect).toHaveValue('home');
  await page.getByLabel('Согласен с условиями подключения').check();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect
    .poll(() => submitted)
    .toEqual({
      shopName: 'Мастерская',
      email: 'example@example.test',
      phone: '+996700123456',
      city: 'Бишкек',
      address: '',
      category: 'Товары для дома',
      shopType: 'home',
      agreed: true,
    });
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Заявка отправлена',
  );
});

test('page templates stay within the viewport and provide QA screenshots', async ({
  page,
}, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ['catalog', '/'],
      ['product', '/shops/shop-a/products/' + id],
      ['ui-kit', '/ui-kit'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(name + '-' + width + '.png'),
        fullPage: true,
      });
    }
    await page.goto('/shops/shop-a/products/' + id);
    await page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('button', { name: 'В корзину', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('link', { name: /Перейти в корзину/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Корзина', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('cart-' + width + '.png'),
      fullPage: true,
    });
  }
});

test('long store names fit store, product and cart at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/shops/long-store');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Магазин',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .getByRole('heading', { name: 'Керамическая чашка', exact: true })
    .getByRole('link')
    .click();
  await expect(
    page.getByRole('heading', { name: 'Керамическая чашка', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Корзина', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('product descriptions preserve seller line breaks', async ({ page }) => {
  await page.goto('/shops/shop-a/products/' + id);
  expect(await page.locator('.sf-product-description').innerText()).toBe(
    'Для вашего любимого кофе.\nОбъём: 250 мл.',
  );
});

test('buyer can reach partner form through the footer', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Стать партнёром', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Стать партнёром', exact: true }),
  ).toBeVisible();
});
