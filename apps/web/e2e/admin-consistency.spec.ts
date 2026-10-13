import { ownerCookies as getOwnerCookies } from './owner-session';
import { expect, test, type BrowserContext } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111';
let ownerCookies: Awaited<ReturnType<BrowserContext['cookies']>>;
test.beforeAll(async ({ browser }) => {
  ownerCookies = await getOwnerCookies(browser);
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(ownerCookies);
});
test('partner navigation opens products and sales instead of the same overview anchor', async ({
  page,
}) => {
  await page.goto('/seller');
  await page
    .getByRole('navigation', { name: 'Разделы партнёра' })
    .getByRole('link', { name: 'Товары и остатки' })
    .click();
  await expect(page).toHaveURL(new RegExp(`/seller/${shop}/products$`));
  await page.goto('/seller');
  await page
    .getByRole('navigation', { name: 'Разделы партнёра' })
    .getByRole('link', { name: 'Продажи и смены' })
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
  await expect(page.locator('.partner-sidebar')).toHaveCSS(
    'background-color',
    palette,
  );
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
  for (const width of [360, 768, 1024, 1440]) {
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
      page.getByRole('heading', { name: 'Панель партнёра MyStore' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('large revenue stays inside its metric on a narrow phone', async ({
  page,
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
