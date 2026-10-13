import { test, expect } from '@playwright/test';
// A small PNG; the browser converts it to JPEG before confirmation.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWP4wMCAFWEXHbQSAK4hPAH60nP9AAAAAElFTkSuQmCC',
  'base64',
);
test('applies AI suggestions only after review and keeps price and barcode manual in the single create form', async ({
  page,
}) => {
  await page.route('**/api/shops/*/variants/photo-assistant', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        route.request().method() === 'GET'
          ? {
              available: true,
              categories: [
                { id: 'dishes', name: 'Посуда', builtIn: true, children: [] },
                { id: 'other', name: 'Другое', builtIn: true, children: [] },
              ],
            }
          : {
              recognized: true,
              name: 'Красная чашка',
              description: 'Чашка красного цвета.',
              category: 'Посуда',
              subcategory: '',
              confidence: 'low',
              warning: 'Проверьте материал.',
            },
      ),
    });
  });
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page
    .getByRole('combobox', { name: 'Рабочий контекст' })
    .selectOption('shop:11111111-1111-4111-8111-111111111111');
  await page
    .getByRole('link', { name: 'Добавить товар', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Фото товара')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Название', { exact: true }).fill('Моё название');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Штрихкод', { exact: true }).fill('AI-MANUAL-001');
  await page
    .getByRole('button', { name: 'Определить по фото', exact: true })
    .click();
  await expect(
    page.getByText('Проверьте материал.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Моё название',
  );
  await page
    .getByRole('button', { name: 'Применить предложение', exact: true })
    .click();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Красная чашка',
  );
  await expect(
    page.getByRole('combobox', { name: 'Категория', exact: true }),
  ).toHaveValue('Посуда');
  await expect(page.getByLabel('Описание', { exact: true })).toHaveValue(
    'Чашка красного цвета.',
  );
  await expect(page.getByLabel('Цена продажи, сом')).toHaveValue('150');
  await expect(page.getByLabel('Штрихкод', { exact: true })).toHaveValue(
    'AI-MANUAL-001',
  );
  await page
    .getByLabel('Название', { exact: true })
    .fill('Чашка: проверено продавцом');
  await page
    .getByRole('button', { name: 'Сохранить товар', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Чашка: проверено продавцом',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('status')).toContainText(
    'Товар создан. Остаток не изменён.',
  );
});
test('AI failure leaves manual product entry usable', async ({ page }) => {
  await page.route('**/api/shops/*/variants/photo-assistant', async (route) => {
    const info = route.request().method() === 'GET';
    await route.fulfill({
      status: info ? 200 : 503,
      contentType: 'application/json',
      body: JSON.stringify(
        info
          ? {
              available: true,
              categories: [
                { id: 'other', name: 'Другое', builtIn: true, children: [] },
              ],
            }
          : {
              code: 'AI_UNAVAILABLE',
              message:
                'Распознавание временно недоступно. Заполните товар вручную.',
            },
      ),
    });
  });
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page
    .getByRole('combobox', { name: 'Рабочий контекст' })
    .selectOption('shop:11111111-1111-4111-8111-111111111111');
  await page
    .getByRole('link', { name: 'Добавить товар', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Фото товара')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Название', { exact: true }).fill('Ручное название');
  await page
    .getByRole('button', { name: 'Определить по фото', exact: true })
    .click();
  await expect(
    page
      .getByRole('alert')
      .filter({ hasText: 'Распознавание временно недоступно' }),
  ).toBeVisible();
  await expect(page.getByLabel('Название', { exact: true })).toHaveValue(
    'Ручное название',
  );
  await expect(page.getByLabel('Название', { exact: true })).toBeEnabled();
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page
    .getByRole('button', { name: 'Сохранить товар', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Товар создан. Остаток не изменён.',
  );
});
test('photo creation produces zero stock, then explicit receiving posts quantity and cost', async ({
  page,
}) => {
  const shop = '11111111-1111-4111-8111-111111111111';
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page.goto(`/seller/${shop}/products/new`);
  await page
    .getByLabel('Фото товара')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Фото перед сохранением')).toBeVisible();
  await page.getByLabel('Название', { exact: true }).fill('Чашка с фото');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page
    .getByRole('button', { name: 'Сохранить товар', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'Товар создан. Остаток не изменён.',
  );
  await expect(page.getByAltText('Сохранённое фото')).toBeVisible();
  const created = await page.evaluate(
    async ({ shop }) => {
      const list = await (
        await fetch(
          `/api/shops/${shop}/variants?q=${encodeURIComponent('Чашка с фото')}`,
        )
      ).json();
      return list.items.find(
        (v: { name: string }) => v.name === 'Чашка с фото',
      );
    },
    { shop },
  );
  expect(created.physical).toBe(0);
  expect(created.barcode).toMatch(/^MS[0-9A-F]{24}$/);
  await page.getByRole('link', { name: 'Перейти к приёмке' }).click();
  await page.getByLabel('Сканировать штрихкод').fill(created.barcode);
  await page.getByLabel('Сканировать штрихкод').press('Enter');
  await page.getByLabel('Количество Чашка с фото').fill('3');
  await page.getByLabel('Закупочная цена Чашка с фото, сом').fill('80');
  await page.getByRole('button', { name: 'Провести приёмку' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  const after = await page.evaluate(
    async ({ shop, id }) =>
      await (await fetch(`/api/shops/${shop}/stock/${id}`)).json(),
    { shop, id: created.id },
  );
  expect(after.physical).toBe(3);
  expect(after.stockValueMinor).toBe(24000);
});

test('legacy pending photo receiving retries the original operation without a second receipt', async ({
  page,
  context,
  browser,
}) => {
  const { ownerCookies } = await import('./owner-session');
  const shop = '11111111-1111-4111-8111-111111111111';
  await context.addCookies(await ownerCookies(browser));
  await page.goto(`/seller/${shop}/products`);
  const created = await page.evaluate(
    async ({ shop }) => {
      const me = await (await fetch('/api/auth/me')).json();
      const canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      const body = {
        name: 'Прежний приход с фото',
        salePriceMinor: 15000,
        unitCostMinor: 8000,
        quantity: 3,
        category: 'Посуда',
        subcategory: '',
        description: '',
        photoDataUrl: canvas.toDataURL('image/jpeg'),
      };
      const key = crypto.randomUUID(),
        path = `/shops/${shop}/variants/capture`;
      const response = await fetch('/api' + path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': me.csrfToken,
          'idempotency-key': key,
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Legacy fixture failed');
      const variant = await response.json();
      localStorage.setItem(
        `mystore:draft:${me.userId}:${shop}:capture`,
        JSON.stringify({
          version: 1,
          scope: { userId: me.userId, shopId: shop, kind: 'capture' },
          revision: key,
          lines: [],
          submission: { key, path, body, status: 'unknown' },
        }),
      );
      return variant;
    },
    { shop },
  );
  await page.goto(`/seller/${shop}/products/capture`);
  await expect(
    page.getByRole('heading', { name: 'Завершение сохранения товара' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Повторить сохранение' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Товар создан и принят: 3 шт.',
  );
  const stock = await page.evaluate(
    async ({ shop, id }) =>
      await (await fetch(`/api/shops/${shop}/stock/${id}`)).json(),
    { shop, id: created.id },
  );
  expect(stock.physical).toBe(3);
  expect(stock.stockValueMinor).toBe(24000);
});
