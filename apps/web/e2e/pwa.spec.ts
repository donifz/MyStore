import { expect, test } from '@playwright/test';

test('seller login links to an installable manifest and real icons', async ({
  page,
  request,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.goto('/seller/login');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/pwa/manifest.webmanifest',
  );
  const response = await request.get('/pwa/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe('/seller');
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    '192x192',
    '512x512',
  ]);
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src);
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
  }
});

for (const width of [320, 360, 390, 768, 1440]) {
  for (const workspace of ['shop', 'platform']) {
    test(`workspace installation help fits ${workspace} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        return route.fulfill({
          json:
            path === '/api/auth/me'
              ? {
                  userId: 'pwa-owner',
                  email: 'owner@example.test',
                  csrfToken: 'test',
                  platformAdmin: true,
                  shops: [{ id: 'pwa-shop', name: 'Магазин', role: 'owner' }],
                }
              : path.endsWith('/overview')
                ? {
                    shopCount: 1,
                    pendingPartners: 0,
                    pendingProducts: 0,
                    shops: [],
                  }
                : { items: [], total: 0 },
        });
      });
      await page.goto(
        workspace === 'shop' ? '/seller/pwa-shop/products' : '/platform/admin',
      );
      const help = page.locator('.pwa-install');
      await expect(help).toBeVisible();
      if (workspace === 'shop' && width <= 768) {
        const sidebar = await page
          .locator('.workspace-shop > .sidebar')
          .boundingBox();
        expect(sidebar!.height).toBeLessThan(230);
      }
      await help.getByText('Установить MyStore', { exact: true }).click();
      await expect(help.getByText(/iPhone или iPad/)).toBeVisible();
      const header = await page
        .locator('.sidebar .admin-kit-brand')
        .boundingBox();
      expect(header!.width).toBeGreaterThan(100);
      const helpBox = await help.boundingBox();
      const context = await page.locator('.workspace-context').boundingBox();
      expect(helpBox!.y).toBeGreaterThanOrEqual(context!.y + context!.height);
      expect(helpBox!.x + helpBox!.width).toBeLessThanOrEqual(width);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.getByRole('button', { name: 'Выйти', exact: true }),
      ).toBeVisible();
    });
  }
  test(`installation help stays usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
    );
    await page.goto('/seller/login');
    await page.getByText('Установить MyStore', { exact: true }).click();
    await expect(page.getByText(/iPhone или iPad/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Войти', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('install prompt requires a click, cancellation keeps help, and installation hides it', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } }),
  );
  await page.goto('/seller/login');
  await expect(
    page.getByRole('heading', { name: 'С возвращением' }),
  ).toBeVisible();
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        document.body.dataset.installPrompted = 'yes';
      },
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);
  });
  const install = page.getByRole('button', {
    name: 'Установить приложение',
    exact: true,
  });
  await expect(install).toBeVisible();
  await expect(page.locator('body')).not.toHaveAttribute(
    'data-install-prompted',
    'yes',
  );
  await install.click();
  await expect(page.locator('body')).toHaveAttribute(
    'data-install-prompted',
    'yes',
  );
  await expect(install).toHaveCount(0);
  await page.getByText('Установить MyStore', { exact: true }).click();
  await expect(page.getByText(/Для входа, продаж/)).toBeVisible();
  await page.evaluate(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });
  await expect(page.locator('.pwa-install')).toHaveCount(0);
});
