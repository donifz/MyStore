import { expect, test } from '@playwright/test';
import { ownerCookies } from './owner-session';
test.use({ locale: 'ru-RU' });
const shop = '11111111-1111-4111-8111-111111111111';
test.beforeEach(async ({ browser, context }) => {
  await context.addCookies(await ownerCookies(browser));
});
for (const width of [390, 768, 1440]) {
  test(`owner configures weekly hours and keeps edits after errors at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/seller/${shop}/storefront`);
    await expect(
      page.getByRole('heading', { name: 'Рабочие часы и резерв' }),
    ).toBeVisible();
    const enabled = page.getByLabel('Учитывать рабочие часы');
    if (await enabled.isChecked()) await enabled.uncheck();
    await expect(page.getByText(/Расписание не настроено/)).toBeVisible();
    await enabled.check();
    await page.getByLabel('Пн, начало 1').fill('11:00');
    await page.getByRole('button', { name: 'Скопировать Пн на будни' }).click();
    await page.getByLabel('Часовой пояс', { exact: true }).fill('Asia/Bishkek');
    const save = page.getByRole('button', {
      name: 'Сохранить витрину',
      exact: true,
    });
    await save.click();
    await expect(page.getByText('Настройки витрины сохранены.')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Пн, начало 1')).toHaveValue('11:00');
    await expect(page.getByLabel('Пт, начало 1')).toHaveValue('11:00');
    await expect(page.getByLabel('Выходной, Сб')).toBeChecked();
    await expect(page.getByLabel('Часовой пояс', { exact: true })).toHaveValue(
      'Asia/Bishkek',
    );
    await page.getByLabel('Пн, начало 1').fill('21:00');
    await page.getByLabel('Пн, конец 1').fill('02:00');
    await expect(page.getByText('До следующего дня')).toBeVisible();
    await page.getByLabel('Часовой пояс', { exact: true }).fill('invalid-zone');
    await save.click();
    await expect(page.getByRole('alert')).toContainText('часовой пояс');
    await expect(page.getByLabel('Пн, начало 1')).toHaveValue('21:00');
    await expect(page.getByLabel('Пн, конец 1')).toHaveValue('02:00');
    await page.getByLabel('Часовой пояс', { exact: true }).fill('Asia/Bishkek');
    await save.click();
    await expect(page.getByText('Настройки витрины сохранены.')).toBeVisible();
    await page.getByLabel('Пн, начало 1').focus();
    await expect(page.getByLabel('Пн, начало 1')).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('heading', { name: 'Рабочие часы и резерв' })
      .scrollIntoViewIfNeeded();
    await page
      .locator('.business-hours-day')
      .first()
      .screenshot({ path: info.outputPath(`working-hours-row-${width}.png`) });
    await page.screenshot({
      path: info.outputPath(`working-hours-${width}.png`),
      fullPage: true,
    });
  });
}

test('saved settings determine new order deadline and do not rewrite old reservations', async ({
  request,
}) => {
  const { Client } = await import('pg');
  const { randomUUID } = await import('node:crypto');
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Dedicated test database required');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const variant = randomUUID();
    await db.query(
      'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor) VALUES($1,$2,$3,$4,100)',
      [variant, shop, 'Товар для резерва', randomUUID()],
    );
    await db.query(
      "INSERT INTO product_publications(variant_id,shop_id,name,description,category,subcategory) VALUES($1,$2,$3,'','','')",
      [variant, shop, 'Товар для резерва'],
    );
    await db.query(
      'INSERT INTO stock_balances(shop_id,variant_id,physical,reserved,stock_value_minor) VALUES($1,$2,5,0,0)',
      [shop, variant],
    );
    // All day except one minute: the fixture instant must fall in an open window.
    const allDay = Array.from({ length: 7 }, () => [
      { open: '00:00', close: '12:00' },
      { open: '12:00', close: '23:59' },
    ]);
    await db.query(
      "UPDATE shops SET published=true,pickup_enabled=true,time_zone='UTC',business_schedule=$2 WHERE id=$1",
      [shop, JSON.stringify(allDay)],
    );
    const [{ slug }] = (
      await db.query('SELECT slug FROM shops WHERE id=$1', [shop])
    ).rows;
    const key = randomUUID();
    const body = {
      checkoutKey: key,
      storeSlug: slug,
      name: 'Тест',
      phone: '+996700123456',
      fulfillment: 'pickup',
      address: '',
      comment: '',
      lines: [{ variantId: variant, quantity: 1, expectedUnitPriceMinor: 100 }],
    };
    const origin = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
    const orderResponse = await request.post('/api/public/orders', {
      headers: { origin },
      data: body,
    });
    expect(orderResponse.ok()).toBe(true);
    const order = await orderResponse.json();
    const [{ created_at, expires_at }] = (
      await db.query(
        'SELECT created_at,expires_at FROM online_orders WHERE id=$1',
        [order.id],
      )
    ).rows;
    const duration = expires_at.getTime() - created_at.getTime();
    expect(duration).toBeGreaterThanOrEqual(120 * 60_000);
    expect(duration).toBeLessThanOrEqual(121 * 60_000);
    await db.query('UPDATE shops SET business_schedule=NULL WHERE id=$1', [
      shop,
    ]);
    const retry = await request.post('/api/public/orders', {
      headers: { origin },
      data: body,
    });
    expect(await retry.json()).toEqual(order);
    const [{ reserved }] = (
      await db.query(
        'SELECT reserved FROM stock_balances WHERE variant_id=$1',
        [variant],
      )
    ).rows;
    expect(Number(reserved)).toBe(1);
  } finally {
    await db.end();
  }
});

test('cashier and manager cannot change hours through the API or protected page', async ({
  browser,
  request,
}) => {
  const { Client } = await import('pg');
  const { randomUUID } = await import('node:crypto');
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Dedicated test database required');
  const db = new Client({ connectionString: url });
  await db.connect();
  const email = `hours-manager-${randomUUID()}@example.test`;
  const id = randomUUID();
  try {
    await db.query(
      'INSERT INTO users(id,email,password_hash) SELECT $1,$2,password_hash FROM users WHERE email=$3',
      [id, email, 'owner@example.test'],
    );
    await db.query(
      "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'manager')",
      [shop, id],
    );
  } finally {
    await db.end();
  }
  for (const account of [email, 'cashier@example.test']) {
    const login = await request.post('/api/auth/login', {
      data: { email: account, password: 'browser-test-password' },
    });
    expect(login.ok()).toBe(true);
    const { token } = await login.json();
    const changed = await request.put(`/api/shops/${shop}/storefront`, {
      headers: { authorization: `Bearer ${token}` },
      data: {
        description: '',
        city: 'Ош',
        address: '',
        phone: '+996700123456',
        hours: '',
        published: false,
        timeZone: 'UTC',
      },
    });
    expect(changed.status()).toBe(403);
  }
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/seller/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page
      .getByLabel('Пароль', { exact: true })
      .fill('browser-test-password');
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
    await page.goto(`/seller/${shop}/storefront`);
    await expect(page.getByRole('alert')).toContainText('Нет доступа');
    await expect(
      page.getByRole('button', { name: 'Сохранить витрину', exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});
