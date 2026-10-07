import { test, expect } from '@playwright/test';
test('partner creates a draft, publishes inventory and buyers browse without login', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Найдите своё в магазинах рядом' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Стать партнёром', exact: true })
    .click();
  await page.getByLabel('Название магазина').fill('Магазин у дома');
  await page.getByLabel('Email').fill('partner-browser@example.test');
  await page.getByLabel('Пароль').fill('partner-browser-password');
  await page.getByRole('button', { name: 'Создать магазин' }).click();
  await expect(page.getByRole('status')).toContainText('Магазин создан.');
  await page.getByRole('link', { name: 'Войти в кабинет' }).click();
  await page.getByLabel('Email').fill('partner-browser@example.test');
  await page.getByLabel('Пароль').fill('partner-browser-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Керамическая чашка');
  await page.getByLabel('Цена продажи, сом').fill('240');
  await page.getByRole('button', { name: 'Сохранить товар' }).click();
  await page.getByRole('link', { name: 'Витрина', exact: true }).click();
  await page.getByLabel('Город', { exact: true }).fill('Ош');
  await page.getByLabel('Телефон для покупателей').fill('+996700123456');
  await page.getByLabel('Описание магазина').fill('Посуда для вашего дома');
  await page.getByLabel('Опубликовать магазин').check();
  await page.getByRole('button', { name: 'Сохранить витрину' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Настройки витрины сохранены',
  );
  const url = await page
    .getByRole('link', { name: 'Открыть витрину ↗' })
    .getAttribute('href');
  expect(url).toMatch(/^\/shops\/shop-/);
  const buyer = await context.browser()!.newContext({
    baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001',
    viewport: { width: 360, height: 800 },
  });
  try {
    const publicPage = await buyer.newPage();
    await publicPage.goto(url!);
    await expect(
      publicPage.getByRole('heading', { name: 'Магазин у дома', exact: true }),
    ).toBeVisible();
    await publicPage.getByRole('link', { name: /Керамическая чашка/ }).click();
    await expect(
      publicPage.getByRole('heading', {
        name: 'Керамическая чашка',
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      publicPage.getByText('Нет в наличии', { exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole('link', { name: 'Связаться с магазином' }),
    ).toHaveAttribute('href', 'tel:+996700123456');
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await publicPage.reload();
    await expect(
      publicPage.getByRole('heading', {
        name: 'Керамическая чашка',
        exact: true,
      }),
    ).toBeVisible();
    await publicPage.goto('/');
    await expect(
      publicPage.getByRole('link', { name: /Керамическая чашка/ }),
    ).toBeVisible();
  } finally {
    await buyer.close();
  }
});
