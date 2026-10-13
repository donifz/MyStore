import { ownerCookies } from './owner-session';
import { test, expect } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111';
test.beforeEach(async ({ browser, context }) => {
  await context.addCookies(await ownerCookies(browser));
});
for (const width of [390, 1440]) {
  test(`seller opens the current storefront without needing refresh at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/seller/${shop}/storefront`);
    await page.getByLabel('Город', { exact: true }).fill('Бишкек');
    await page.getByLabel('Телефон для покупателей').fill('+996700123456');
    await page.getByLabel('Опубликовать магазин').check();
    await page.getByRole('button', { name: 'Сохранить витрину' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Настройки витрины сохранены',
    );
    const open = page.getByRole('link', { name: 'Открыть витрину' });
    const href = await open.getAttribute('href');
    await open.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('.sf-header')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.market-header')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.sf-header')).toBeVisible();
  });
}
