import { test, expect } from '@playwright/test';
// A small PNG; the browser converts it to JPEG before confirmation.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWP4wMCAFWEXHbQSAK4hPAH60nP9AAAAAElFTkSuQmCC',
  'base64',
);
test('applies AI suggestions only after review and keeps prices, quantity and barcode manual', async ({
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
    .getByRole('link', { name: 'Скан / фото товара', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Фото товара')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: png });
  await page.getByLabel('Название', { exact: true }).fill('Моё название');
  await page.getByLabel('Закупочная цена, сом').fill('80');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Количество', { exact: true }).fill('3');
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
  await expect(page.getByLabel('Закупочная цена, сом')).toHaveValue('80');
  await expect(page.getByLabel('Цена продажи, сом')).toHaveValue('150');
  await expect(page.getByLabel('Количество', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('Штрихкод', { exact: true })).toHaveValue(
    'AI-MANUAL-001',
  );
  await page
    .getByLabel('Название', { exact: true })
    .fill('Чашка: проверено продавцом');
  await page
    .getByRole('button', { name: 'Проверить товар', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Подтвердить и принять товар', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'Чашка: проверено продавцом',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('status').filter({ hasText: 'Товар создан и принят' }),
  ).toContainText('3 шт.');
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
    .getByRole('link', { name: 'Скан / фото товара', exact: true })
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
  await page.getByLabel('Закупочная цена, сом').fill('80');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page
    .getByRole('button', { name: 'Проверить товар', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Подтвердите товар' }),
  ).toBeVisible();
});
test('photographs product, previews fields and receives it with generated codes', async ({
  page,
}) => {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page
    .getByRole('combobox', { name: 'Рабочий контекст' })
    .selectOption('shop:11111111-1111-4111-8111-111111111111');
  await page
    .getByRole('link', { name: 'Скан / фото товара', exact: true })
    .first()
    .click();
  await page
    .getByLabel('Фото товара')
    .setInputFiles({ name: 'product.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByAltText('Фото перед сохранением')).toBeVisible();
  await page.getByLabel('Название', { exact: true }).fill('Чашка с фото');
  await page.getByLabel('Закупочная цена, сом').fill('80');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Количество', { exact: true }).fill('3');
  await page
    .getByRole('button', { name: 'Проверить товар', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Подтвердите товар' }),
  ).toBeVisible();
  let markLost!: () => void;
  const lostResponse = new Promise<void>((resolve) => {
    markLost = resolve;
  });
  await page.route('**/api/shops/*/variants/capture', async (route) => {
    await route.fetch();
    await route.abort('failed');
    markLost();
  });
  await page
    .getByRole('button', { name: 'Подтвердить и принять товар', exact: true })
    .click();
  await lostResponse;
  await expect(page.getByRole('alert').last()).toContainText('неизвестен');
  await page.unroute('**/api/shops/*/variants/capture');
  await page.reload();
  await page
    .getByRole('button', { name: 'Повторить сохранение', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText('Товар создан и принят');
  await expect(page.getByText(/Артикул: MS-/)).toBeVisible();
  await expect(page.getByText(/Штрихкод: MS/)).toBeVisible();
  await expect(page.getByAltText('Сохранённое фото')).toBeVisible();
  await page.getByRole('link', { name: 'Товары', exact: true }).first().click();
  await expect(
    page.getByRole('row').filter({ hasText: 'Чашка с фото' }),
  ).toContainText('3');
});
