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
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();

  await page.goto(`/seller/${shop}/products/capture`);
  const nav = page.locator('.sidebar nav');
  const captureLink = nav.getByRole('link', {
    name: 'Скан / фото товара',
    exact: true,
  });
  const productsLink = nav.getByRole('link', {
    name: 'Товары',
    exact: true,
  });
  await expect(captureLink).toHaveClass(/active/);
  await expect(captureLink).toHaveCSS('font-weight', '600');
  await expect(productsLink).toHaveCSS('font-weight', '400');

  await page.goto(`/seller/${shop}/products`);
  await expect(productsLink).toHaveClass(/active/);
  await expect(productsLink).toHaveCSS('font-weight', '600');
});

test('admin heading keeps the date inside its tablet container', async ({
  page,
}) => {
  await page.setViewportSize({ width: 721, height: 900 });
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();
  await page.goto('/platform/admin');
  await expect(
    page.getByRole('heading', {
      name: 'Администрирование MyStore',
      exact: true,
    }),
  ).toBeVisible();
  const heading = await page.locator('.admin-kit-heading').boundingBox();
  const date = await page.locator('.admin-kit-date').boundingBox();
  expect(date!.x + date!.width).toBeLessThanOrEqual(
    heading!.x + heading!.width + 1,
  );
  await expectNoPageOverflow(page);
});
