import { expect, test } from '@playwright/test';
import { ownerCookies } from './owner-session';
const shop = '11111111-1111-4111-8111-111111111111';
test.beforeEach(async ({ browser, context }) => {
  await context.addCookies(await ownerCookies(browser));
});
async function openCapture(page: import('@playwright/test').Page) {
  await page.goto('/seller/' + shop + '/products/capture');
  await expect(
    page.getByRole('heading', { name: 'Новый товар в приёмке', exact: true }),
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
      // Start from a known scroll position: navigation/redirect may restore
      // the scroll offset of the main panel at narrower viewports.
      await content.evaluate((element) => {
        element.scrollTop = 0;
      });
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
test('mobile seller layout keeps normal document scroll and fixed bottom navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCapture(page);
  await page.mouse.move(300, 500);
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
      .evaluate((e) => getComputedStyle(e).position),
  ).toBe('fixed');
  await page.getByLabel('Название', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByLabel('Название', { exact: true })).toBeVisible();
});
