import { expect, test, type BrowserContext } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111';
let ownerCookies: Awaited<ReturnType<BrowserContext['cookies']>>;
test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(
    (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001') + '/seller/login',
  );
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page.goto('/seller/' + shop + '/products');
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();
  ownerCookies = await context.cookies();
  await context.close();
});
test.beforeEach(async ({ context }) => {
  await context.addCookies(ownerCookies);
});
async function openCapture(page: import('@playwright/test').Page) {
  await page.goto('/seller/' + shop + '/products/capture');
  await expect(
    page.getByRole('heading', { name: 'Скан / фото товара', exact: true }),
  ).toBeVisible();
}
for (const width of [821, 1024, 1440]) {
  test(
    'seller menu and content scroll independently at ' + width + 'px',
    async ({ page }) => {
      await page.setViewportSize({ width, height: 600 });
      await openCapture(page);
      const sidebar = page.locator('.sidebar');
      const content = page.locator('.content');
      expect(
        await sidebar.evaluate((e) => e.scrollHeight > e.clientHeight),
      ).toBe(true);
      const headerTop = (await page.locator('.topbar').boundingBox())!.y;
      await sidebar.hover();
      await page.mouse.wheel(0, 2000);
      await expect
        .poll(() => sidebar.evaluate((e) => e.scrollTop))
        .toBeGreaterThan(0);
      expect(await content.evaluate((e) => e.scrollTop)).toBe(0);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await expect(
        page.getByRole('button', { name: 'Выйти', exact: true }),
      ).toBeInViewport();
      const menuScroll = await sidebar.evaluate((e) => e.scrollTop);
      await content.hover();
      await page.mouse.wheel(0, 500);
      await expect
        .poll(() => content.evaluate((e) => e.scrollTop))
        .toBeGreaterThan(0);
      expect(await sidebar.evaluate((e) => e.scrollTop)).toBe(menuScroll);
      expect((await page.locator('.topbar').boundingBox())!.y).toBe(headerTop);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      // Scrolling beyond either region's boundary must not move the document.
      await page.mouse.wheel(0, 10000);
      expect(await page.evaluate(() => scrollY)).toBe(0);
      await page.getByLabel('Название', { exact: true }).focus();
      await expect(page.getByLabel('Название', { exact: true })).toBeFocused();
    },
  );
}
test('mobile seller layout keeps normal document scroll and horizontal navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page);
  await page.mouse.move(300, 750);
  await page.mouse.wheel(0, 700);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .locator('.sidebar nav')
      .evaluate((e) => e.scrollWidth > e.clientWidth),
  ).toBe(true);
  await page.getByLabel('Название', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Название', { exact: true })).toBeVisible();
});
