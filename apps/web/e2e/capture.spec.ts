import { test, expect } from '@playwright/test';
// A small PNG; the browser converts it to JPEG before confirmation.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWP4wMCAFWEXHbQSAK4hPAH60nP9AAAAAElFTkSuQmCC',
  'base64',
);
test('photographs product, previews fields and receives it with generated codes', async ({
  page,
}) => {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
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
