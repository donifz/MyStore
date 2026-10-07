import { test, expect, Page } from '@playwright/test';
const shop = '11111111-1111-4111-8111-111111111111',
  root = '/seller/' + shop;
async function login(page: Page, email = 'owner@example.test') {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
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
  await page.getByRole('button', { name: 'Сохранить товар' }).click();
  await expect(
    page.getByText('Товар создан. Остаток не изменён.'),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Перейти к приёмке' }).click();
  await scan(page, 3);
  await expect(page.getByLabel('Количество Рюкзак City')).toHaveValue('3');
  await page.getByLabel('Количество Рюкзак City').fill('10');
  await page.getByLabel('Закупочная цена Рюкзак City, сом').fill('100');
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
  await page.getByRole('button', { name: 'Сохранить товар' }).click();
  await expect(
    page.getByText('Товар создан. Остаток не изменён.'),
  ).toBeVisible();
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
  const salesBefore = (
    await (await page.request.get('/api/shops/' + shop + '/pos/sales')).json()
  ).total;
  await page.getByRole('link', { name: 'Добавить товар' }).click();
  await page.getByLabel('Название', { exact: true }).fill('Рюкзак Concurrent');
  await page.getByLabel('Штрихкод', { exact: true }).fill('0012345678929');
  await page.getByLabel('Цена продажи, сом').fill('150');
  await page.getByRole('button', { name: 'Сохранить товар' }).click();
  await page.getByRole('link', { name: 'Перейти к приёмке' }).click();
  await scan(page, 1, '0012345678929');
  await page.getByLabel('Количество Рюкзак Concurrent').fill('5');
  await page.getByLabel('Закупочная цена Рюкзак Concurrent, сом').fill('100');
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
  await other.getByLabel('Способ оплаты').selectOption('card');
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
  await expect(page.getByText('4 шт.', { exact: true })).toBeVisible();
  await page.goto(root + '/sales');
  await expect(page.getByRole('link', { name: 'Открыть продажу' })).toHaveCount(
    salesBefore + 1,
  );
  await other.close();
});
