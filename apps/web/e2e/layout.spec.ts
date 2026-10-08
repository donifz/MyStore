import { expect, Page, test } from '@playwright/test';

const shop = '11111111-1111-4111-8111-111111111111';

async function expectNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
}

test('core layouts stay inside the viewport at supported widths', async ({
  page,
}) => {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();

  const protectedPages = [
    `/seller/${shop}/products`,
    `/seller/${shop}/products/capture`,
    `/seller/${shop}/reports`,
    `/seller/${shop}/operations`,
    '/platform/admin',
  ];

  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of protectedPages) {
      await page.goto(url);
      await expectNoPageOverflow(page);
    }
    await page.goto('/');
    await expectNoPageOverflow(page);
    await page.goto('/shops');
    await expectNoPageOverflow(page);
  }
});

test('seller navigation highlights only the current leaf section', async ({
  page,
}) => {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();

  await page.goto(`/seller/${shop}/products/capture`);
  const nav = page.locator('.sidebar nav');
  await expect(nav.locator('a.active')).toHaveCount(1);
  await expect(
    nav.getByRole('link', { name: 'Скан / фото товара', exact: true }),
  ).toHaveClass(/active/);
  await expect(
    nav.getByRole('link', { name: 'Товары', exact: true }),
  ).not.toHaveClass(/active/);

  await page.goto(`/seller/${shop}/products`);
  await expect(nav.locator('a.active')).toHaveCount(1);
  await expect(
    nav.getByRole('link', { name: 'Товары', exact: true }),
  ).toHaveClass(/active/);
});
