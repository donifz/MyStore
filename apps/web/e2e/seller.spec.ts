import { ownerCookies } from './owner-session';
import { test, expect, Page } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111',
  root = '/seller/' + shop;
async function login(page: Page, email = 'owner@example.test') {
  if (email === 'owner@example.test') {
    await page
      .context()
      .addCookies(await ownerCookies(page.context().browser()!));
    await page.goto(root + '/products');
    await expect(
      page.getByRole('heading', { name: 'Товары', exact: true }),
    ).toBeVisible();
    return;
  }
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page.goto(root + '/products');
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();
}
async function scan(page: Page, n: number, code = '0012345678905') {
  const input = page.getByLabel('Сканировать штрихкод');
  for (let i = 0; i < n; i++) {
    await input.fill(code);
    await input.press('Enter');
  }
}
test('seller flow: receive, shift, lost response retry, return and close', async ({
  page,
  context,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Рюкзак City');
  await page.getByLabel('Штрихкод', { exact: true }).fill('0012345678905');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Закупочная цена, сом').fill('100');
  await page.getByLabel('Количество первичной приёмки').fill('10');
  await page.getByRole('button', { name: 'Добавить в приёмку' }).click();
  await expect(
    page.getByText('Товар добавлен в список приёмки.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Количество Рюкзак City')).toHaveValue('10');
  await page.getByRole('button', { name: 'Провести приёмку' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await page.goto(root + '/shift');
  await page.getByLabel('Начальные наличные, сом').fill('100');
  let openingDropped = false;
  await page.route('**/api/shops/*/pos/shifts', async (route) => {
    if (route.request().method() === 'POST' && !openingDropped) {
      openingDropped = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Открыть смену' }).click();
  await expect(
    page.getByRole('button', { name: 'Повторить открытие' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Смена открыта', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить открытие' }).click();
  await expect(
    page.getByRole('button', { name: 'Повторить открытие' }),
  ).toHaveCount(0);
  await page.unroute('**/api/shops/*/pos/shifts');
  await page.goto(root + '/pos');
  await scan(page, 2);
  await expect(page.getByLabel('Количество Рюкзак City')).toHaveValue('2');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: 'test-results/seller-pos.png',
    fullPage: true,
  });
  // The desktop checkout must be visible without scrolling the document.
  const desktopCheckout = page.getByRole('region', { name: 'Оплата чека' });
  await expect(desktopCheckout).toBeVisible();
  await expect(desktopCheckout.getByRole('button', { name: /Покупатель/ })).toBeVisible();
  await expect(desktopCheckout.locator('.pos-option-customer')).toBeVisible();
  await expect(desktopCheckout.locator('.pos-option-discount')).toBeVisible();
  await expect(desktopCheckout.getByLabel('Скидка при оплате')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight + 2,
    ),
  ).toBe(true);
  // On mobile the action buttons form two non-collapsing columns and the
  // payment form remains in a separate, permanently visible footer.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Оплатить —/ }).click();
  const mobileCheckout = page.getByRole('dialog', { name: 'Оплата чека' });
  await expect(mobileCheckout).toBeVisible();
  const cards = mobileCheckout.locator('.pos-sheet-body .pos-payment-option');
  const cardBoxes = await cards.evaluateAll((elements) =>
    elements.map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x, y: box.y, height: box.height };
    }),
  );
  expect(cardBoxes.length).toBeGreaterThanOrEqual(2);
  expect(cardBoxes.every((box) => box.height >= 76)).toBe(true);
  expect(Math.abs(cardBoxes[0].y - cardBoxes[1].y)).toBeLessThan(2);
  await expect(mobileCheckout.getByRole('button', { name: /Провести продажу/ })).toBeVisible();
  const checkoutFields = await mobileCheckout.locator('.pos-checkout-money-row > label').evaluateAll((elements) =>
    elements.map((el) => {
      const field = el.querySelector('.pos-discount-control, input')?.getBoundingClientRect();
      return field ? { top: field.top, height: field.height } : null;
    }),
  );
  expect(checkoutFields).toHaveLength(2);
  expect(Math.abs(checkoutFields[0]!.top - checkoutFields[1]!.top)).toBeLessThan(2);
  await mobileCheckout.getByRole('button', { name: 'Закрыть оплату' }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await context.setOffline(true);
  await expect(
    page.getByRole('button', { name: 'Провести продажу' }),
  ).toBeDisabled();
  await context.setOffline(false);
  let dropped = false;
  await page.route('**/api/shops/*/pos/sales', async (route) => {
    if (route.request().method() === 'POST' && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.getByRole('button', { name: 'Провести продажу' }).click();
  await expect(
    page.getByRole('button', { name: 'Повторить исходный запрос' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Повторить исходный запрос' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await page.unroute('**/api/shops/*/pos/sales');
  await page.goto(root + '/sales');
  await page.getByRole('link', { name: 'Открыть продажу' }).first().click();
  await page.getByRole('link', { name: 'Оформить возврат' }).click();
  await page.getByLabel('Вернуть Рюкзак City').fill('1');
  await page.getByLabel('Причина возврата').fill('Не подошёл размер');
  await page.getByRole('button', { name: 'Провести возврат' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await page.goto(root + '/products');
  await expect(page.getByText('9 шт.', { exact: true })).toBeVisible();
  await page.goto(root + '/shift');
  await page.getByLabel('Фактические наличные, сом').fill('250');
  await page.getByRole('button', { name: 'Закрыть смену' }).click();
  await expect(page.getByText('Смена закрыта', { exact: true })).toBeVisible();
  await expect(page.getByText('Расхождение: 0,00 сом')).toBeVisible();
  await page.goto(root + '/pos');
  await scan(page, 1);
  await expect(page.getByLabel('Количество Рюкзак City')).toHaveValue('1');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'С возвращением' }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) =>
        k.startsWith('mystore:draft:33333333'),
      ),
    ),
  ).toEqual([]);
});
test('cashier isolation, keyboard entry and responsive layout', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('link', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Рюкзак Cashier');
  await page.getByLabel('Штрихкод', { exact: true }).fill('0012345678912');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Закупочная цена, сом').fill('100');
  await page.getByLabel('Количество первичной приёмки').fill('10');
  await page.getByRole('button', { name: 'Добавить в приёмку' }).click();
  await expect(
    page.getByText('Товар добавлен в список приёмки.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Провести приёмку' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await page.getByRole('button', { name: 'Выйти', exact: true }).click();
  await login(page, 'cashier@example.test');
  await expect(page.getByRole('link', { name: 'Добавить товар' })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole('link', { name: 'Приёмка', exact: true }),
  ).toHaveCount(0);
  await page.goto(root + '/pos');
  await scan(page, 1, '0012345678912');
  await expect(page.getByLabel('Количество Рюкзак Cashier')).toHaveValue('1');
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Фокус для сканера' }).click();
    await expect(page.getByLabel('Сканировать штрихкод')).toBeFocused();
  }
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'unitCost',
  );
  await page.goto(root + '/sales');
  await expect(page.getByRole('link', { name: 'Открыть продажу' })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: 'test-results/cashier-desktop.png',
    fullPage: true,
  });
});

test('two windows post one ordinary draft exactly once before storage events arrive', async ({
  page,
  context,
}) => {
  await context.addInitScript(() =>
    window.addEventListener('storage', (event) =>
      event.stopImmediatePropagation(),
    ),
  );
  await login(page);
  const salesBefore = await page.evaluate(
    async (url) => {
      const r = await fetch(url, { credentials: 'same-origin' });
      if (!r.ok) throw new Error('History request failed: ' + r.status);
      return (await r.json()).total as number;
    },
    '/api/shops/' + shop + '/pos/sales',
  );
  await page.getByRole('link', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Рюкзак Concurrent');
  await page.getByLabel('Штрихкод', { exact: true }).fill('0012345678929');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByLabel('Закупочная цена, сом').fill('100');
  await page.getByLabel('Количество первичной приёмки').fill('5');
  await page.getByRole('button', { name: 'Добавить в приёмку' }).click();
  await page.getByRole('button', { name: 'Провести приёмку' }).click();
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await page.goto(root + '/shift');
  await page.getByRole('button', { name: 'Открыть смену' }).click();
  await expect(page.getByText('Смена открыта', { exact: true })).toBeVisible();
  await page.goto(root + '/pos');
  await scan(page, 1, '0012345678929');
  await expect(page.getByLabel('Количество Рюкзак Concurrent')).toHaveValue(
    '1',
  );
  const other = await context.newPage();
  await other.goto(root + '/pos');
  await expect(other.getByLabel('Количество Рюкзак Concurrent')).toHaveValue(
    '1',
  );
  await other
    .getByRole('radio', { name: /Безналичные|Банковская карта/ })
    .check();
  const requests: { key: string | undefined; body: unknown }[] = [];
  let release!: () => void;
  const bothCaptured = new Promise<void>((resolve) => {
    release = resolve;
  });
  await context.route('**/api/shops/*/pos/sales', async (route) => {
    if (route.request().method() === 'POST') {
      requests.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postDataJSON(),
      });
      if (requests.length === 2) release();
      await bothCaptured;
    }
    await route.continue();
  });
  await Promise.all([
    page.getByRole('button', { name: 'Провести продажу' }).click(),
    other.getByRole('button', { name: 'Провести продажу' }).click(),
  ]);
  await expect(page.getByRole('status')).toContainText('Документ проведён');
  await expect(other.getByRole('status')).toContainText('Документ проведён');
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  await page.goto(root + '/products');
  await expect(
    page
      .getByRole('row', { name: /Рюкзак Concurrent/ })
      .getByText('4 шт.', { exact: true }),
  ).toBeVisible();
  await page.goto(root + '/sales');
  await expect(page.getByRole('link', { name: 'Открыть продажу' })).toHaveCount(
    salesBefore + 1,
  );
  await other.close();
});
