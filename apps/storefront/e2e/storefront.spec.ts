import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
for (const width of [320, 390, 768, 1440]) {
  test(`catalog has a usable grid without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?q=long');
    await expect(
      page.getByRole('heading', { name: 'Каталог товаров' }),
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
    await expect(page.getByLabel('Поиск')).toBeVisible();
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
  await page.getByRole('link', { name: /Керамическая чашка/ }).click();
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
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
  await page.route('**/api/public/orders', (route) =>
    route.fulfill({ status: 503, body: '{}', contentType: 'application/json' }),
  );
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
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Ваш телефон').fill('+996700123456');
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Результат неизвестен',
  );
  await expect(page.getByLabel('Количество Керамическая чашка')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Подтвердить заказ' }),
  ).toBeDisabled();
  recover = true;
  await page.getByRole('button', { name: 'Проверить заказ' }).click();
  await expect(
    page.getByRole('heading', { name: 'Заказ принят' }),
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

test('store replacement requires confirmation and successful checkout keeps the payload', async ({
  page,
}) => {
  await page.goto('/shops/shop-a/products/' + id);
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.goto('/shops/no-phone/products/' + id);
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Заменить корзину' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Оставить корзину' }).click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('mystore-cart-v1')!)[0].storeSlug,
    ),
  ).toBe('shop-a');
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.getByRole('button', { name: 'Заменить корзину' }).click();
  await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
  const request = page.waitForRequest(
    (r) => r.url().endsWith('/api/public/orders') && r.method() === 'POST',
  );
  await page.route('**/api/public/orders', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'success-1',
        status: 'new',
        totalMinor: 24000,
        expiresAt: null,
        storeName: 'Магазин у дома',
      }),
    }),
  );
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Ваш телефон').fill('+996700123456');
  await page.getByRole('button', { name: 'Подтвердить заказ' }).click();
  const payload = (await request).postDataJSON();
  expect(payload.storeSlug).toBe('no-phone');
  expect(payload.lines).toEqual([
    { variantId: id, quantity: 1, expectedUnitPriceMinor: 24000 },
  ]);
  expect(payload.checkoutKey).toMatch(/^[\da-f-]{36}$/);
  await expect(
    page.getByRole('heading', { name: 'Заказ принят' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('mystore-cart-v1')!),
    ),
  ).toEqual([]);
});

test('partner form submits the same data and announces success', async ({
  page,
}) => {
  await page.route('**/api/partners/applications', (route) =>
    route.fulfill({ status: 201, contentType: 'application/json', body: '{}' }),
  );
  await page.goto('/partner');
  await page.getByLabel('Название магазина').fill('Мастерская');
  await page.getByLabel('Email', { exact: true }).fill('example@example.test');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page.getByLabel('Город').fill('Бишкек');
  await page.getByLabel('Категория бизнеса').fill('Посуда');
  await page.getByLabel('Согласен с условиями подключения').check();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
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
    await page.getByRole('button', { name: 'В корзину', exact: true }).click();
    await page
      .getByRole('link', { name: 'Оформить заказ', exact: true })
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
  await page.getByRole('link', { name: /Керамическая чашка/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Керамическая чашка', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'В корзину', exact: true }).click();
  await page.getByRole('link', { name: 'Оформить заказ', exact: true }).click();
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
