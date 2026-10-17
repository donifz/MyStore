import { Client } from 'pg';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { ownerCookies as getOwnerCookies } from './owner-session';
import { expect, test, type BrowserContext } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111';
const multiEmail = 'layout-multi-' + randomUUID() + '@example.test';
let ownerCookies: Awaited<ReturnType<BrowserContext['cookies']>>;
test.beforeAll(async ({ browser }) => {
  ownerCookies = await getOwnerCookies(browser);
  const url = process.env.TEST_DATABASE_URL!;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Dedicated database required');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const salt = randomBytes(16).toString('hex'),
      hash =
        salt +
        ':' +
        scryptSync('browser-test-password', salt, 64).toString('hex'),
      user = randomUUID(),
      second = randomUUID();
    await db.query(
      'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
      [user, multiEmail, hash],
    );
    await db.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
      second,
      'Второй собственный магазин',
    ]);
    for (const id of [shop, second])
      await db.query(
        "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
        [id, user],
      );
  } finally {
    await db.end();
  }
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(ownerCookies);
});
test('context navigation opens owned products and sales inside the common cabinet', async ({
  page,
}) => {
  await page.goto('/seller');
  await page
    .getByRole('combobox', { name: 'Рабочий контекст' })
    .selectOption('shop:' + shop);
  await expect(page).toHaveURL(new RegExp(`/seller/${shop}/products$`));
  await page
    .getByRole('navigation', { name: 'Разделы кабинета' })
    .getByRole('link', { name: 'Продажи и возвраты', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/seller/${shop}/sales$`));
});
test('all workspaces share the admin palette and give staff and email controls room', async ({
  page,
}) => {
  await page.goto('/platform/admin');
  const palette = await page
    .locator('.admin-kit-sidebar')
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  await page.goto('/seller');
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', palette);
  await page.goto(`/seller/${shop}/staff`);
  await expect(page.locator('.sidebar')).toHaveCSS('background-color', palette);
  const cards = page.locator('.content .panel');
  await expect(cards).toHaveCount(3);
  const first = await cards.nth(0).boundingBox(),
    second = await cards.nth(1).boundingBox();
  expect(second!.y - (first!.y + first!.height)).toBeGreaterThanOrEqual(16);
  await page.goto(`/seller/${shop}/operations`);
  const checkbox = page.getByLabel('Новые заказы');
  await expect(checkbox).toBeVisible();
  const box = await checkbox.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(24);
  const label = await checkbox.locator('..').boundingBox();
  expect(label!.height).toBeLessThanOrEqual(48);
});

test('all seller screens remain inside the viewport on mobile, tablet and desktop', async ({
  page,
}) => {
  test.setTimeout(120000);
  const routes = [
    'products',
    'products/new',
    'products/capture',
    'labels',
    'categories',
    'receiving',
    'inventory',
    'orders',
    'operations',
    'staff',
    'storefront',
    'pos',
    'shift',
    'sales',
    'reports',
  ];
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(`/seller/${shop}/${route}`);
      await expect(page.locator('.content h1').first()).toBeVisible();
      await expect(
        page
          .locator('.sidebar')
          .getByRole('button', { name: 'Выйти', exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${route} at ${width}px`,
      ).toBe(true);
    }
    await page.goto('/seller');
    await expect(
      page.getByRole('heading', { name: 'Администрирование MyStore' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `platform admin (/seller) at ${width}px`,
    ).toBe(true);
  }
});

test('large revenue stays inside its metric on a narrow phone', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.route('**/api/shops/*/reports/summary', (route) =>
    route.fulfill({
      json: {
        revenueMinor: 1000000000,
        physicalUnits: 100000,
        openOrders: 50,
        closedShifts: 50,
      },
    }),
  );
  await context.clearCookies();
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill(multiEmail);
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/view=shops/);
  await page.goto('/seller');
  const metrics = page.locator('.admin-kit-metric');
  await expect(metrics.nth(2).locator('strong')).toContainText('сом');
  const revenue = await metrics.nth(2).boundingBox(),
    orders = await metrics.nth(3).boundingBox();
  expect(orders!.y).toBeGreaterThanOrEqual(revenue!.y + revenue!.height);
  expect(
    await metrics
      .nth(2)
      .locator('strong')
      .evaluate((e) => {
        const range = document.createRange();
        range.selectNodeContents(e);
        return (
          range.getBoundingClientRect().width <=
          e.getBoundingClientRect().width + 1
        );
      }),
  ).toBe(true);
});
