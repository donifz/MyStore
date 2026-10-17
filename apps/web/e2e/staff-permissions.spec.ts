import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';

for (const width of [390, 768, 1440]) {
  test(`owner grants and revokes reports/returns at ${width}px`, async ({
    page,
    browser,
  }) => {
    const shop = randomUUID();
    const employeeId = randomUUID(),
      ownerId = randomUUID();
    const ownerEmail = `permissions-owner-${ownerId}@example.test`;
    const employeeEmail = `permissions-employee-${employeeId}@example.test`;
    const url = process.env.TEST_DATABASE_URL;
    if (!url || !new URL(url).pathname.endsWith('_test'))
      throw new Error('Dedicated test database required');
    const db = new Client({ connectionString: url });
    await db.connect();
    const employee = await browser.newContext({
      baseURL: process.env.E2E_BASE_URL,
      viewport: { width, height: 900 },
    });
    try {
      await db.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
        shop,
        'Проверка разрешений',
      ]);
      for (const [id, email] of [
        [ownerId, ownerEmail],
        [employeeId, employeeEmail],
      ]) {
        await db.query(
          "INSERT INTO users(id,email,password_hash) SELECT $1,$2,password_hash FROM users WHERE email='owner@example.test'",
          [id, email],
        );
      }
      await db.query(
        "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'cashier')",
        [shop, ownerId, employeeId],
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/seller/login');
      await page.getByLabel('Email', { exact: true }).fill(ownerEmail);
      await page
        .getByLabel('Пароль', { exact: true })
        .fill('browser-test-password');
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Товары', exact: true }),
      ).toBeVisible();
      const me = await (await page.request.get('/api/auth/me')).json();
      const headers = {
        'x-csrf-token': me.csrfToken,
        Origin: process.env.E2E_BASE_URL!,
      };
      async function post(path: string, data: unknown) {
        const response = await page.request.post(`/api/shops/${shop}${path}`, {
          headers: { ...headers, 'idempotency-key': randomUUID() },
          data,
        });
        expect(response.status(), await response.text()).toBe(201);
        return response.json();
      }
      const variant = await post('/variants', {
        name: 'Сумка',
        salePriceMinor: 20000,
      });
      await post('/receivings', {
        lines: [{ variantId: variant.id, quantity: 3, unitCostMinor: 7000 }],
      });
      const shift = await post('/pos/shifts', { openingCashMinor: 100000 });
      const sale = await post('/pos/sales', {
        shiftId: shift.id,
        method: 'cash',
        lines: [
          { variantId: variant.id, quantity: 2, expectedUnitPriceMinor: 20000 },
        ],
      });
      await post(`/pos/shifts/${shift.id}/close`, {
        actualCashMinor: 140000,
        comment: '',
      });
      const p = await employee.newPage();
      await p.goto('/seller/login');
      await p.getByLabel('Email', { exact: true }).fill(employeeEmail);
      await p
        .getByLabel('Пароль', { exact: true })
        .fill('browser-test-password');
      await p.getByRole('button', { name: 'Войти', exact: true }).click();
      await p.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
      expect(
        (
          await employee.request.get(`/api/shops/${shop}/reports/summary`)
        ).status(),
      ).toBe(403);
      await page.goto(`/seller/${shop}/staff`);
      const returns = page.getByLabel('Возвраты ' + employeeEmail);
      const reports = page.getByLabel('Финансовые отчёты ' + employeeEmail);
      await expect(returns).not.toBeChecked();
      await returns.click();
      await expect(returns).toBeChecked();
      await expect(reports).toBeEnabled();
      await reports.click();
      await expect(reports).toBeChecked();
      await expect(reports).toBeEnabled();
      await page.reload();
      await expect(returns).toBeChecked();
      await expect(reports).toBeChecked();
      await returns.focus();
      await expect(returns).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/staff-permissions-${width}.png`,
        fullPage: true,
      });
      await p.goto(`/seller/${shop}/reports`);
      await p.reload();
      await expect(
        p.getByRole('heading', { name: 'Отчёты', exact: true }),
      ).toBeVisible();
      await expect(
        p.getByText('Себестоимость проданного', { exact: true }),
      ).toBeVisible();
      const employeeMe = await (
        await employee.request.get('/api/auth/me')
      ).json();
      const opened = await employee.request.post(
        `/api/shops/${shop}/pos/shifts`,
        {
          headers: {
            Origin: process.env.E2E_BASE_URL!,
            'x-csrf-token': employeeMe.csrfToken,
            'idempotency-key': randomUUID(),
          },
          data: { openingCashMinor: 100000 },
        },
      );
      expect(opened.status()).toBe(201);
      await p.goto(`/seller/${shop}/sales/${sale.id}`);
      await p.getByRole('link', { name: 'Оформить возврат' }).click();
      await p.getByLabel('Вернуть Сумка', { exact: true }).fill('1');
      await p.getByLabel('Причина возврата').fill('Возврат покупателя');
      await p
        .getByRole('button', { name: 'Провести возврат', exact: true })
        .click();
      await expect(
        p.getByRole('status').filter({ hasText: /Документ проведён:/ }),
      ).toBeVisible();
      const balance = await db.query(
        'SELECT physical,stock_value_minor FROM stock_balances WHERE shop_id=$1 AND variant_id=$2',
        [shop, variant.id],
      );
      expect(balance.rows[0]).toEqual({
        physical: '2',
        stock_value_minor: '14000',
      });
      await returns.click();
      await expect(returns).not.toBeChecked();
      await expect(reports).toBeEnabled();
      await reports.click();
      await expect(reports).not.toBeChecked();
      await expect(reports).toBeEnabled();
      expect(
        (
          await employee.request.get(`/api/shops/${shop}/reports/summary`)
        ).status(),
      ).toBe(403);
      expect(
        (
          await employee.request.get(
            `/api/shops/${shop}/reports/export/stock.csv`,
          )
        ).status(),
      ).toBe(403);
      await p.reload();
      await expect(
        p.getByRole('button', { name: 'Провести возврат', exact: true }),
      ).toHaveCount(0);
    } finally {
      await employee.close();
      await db.end();
    }
  });
}
