import { expect, test } from '@playwright/test';
import { ownerCookies } from './owner-session';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';

test.use({ locale: 'ru-RU' });
const shop = '11111111-1111-4111-8111-111111111111';

test('owner grants temporary financial access to platform admin, admin reads summary, and owner revokes', async ({
  browser,
  request,
}) => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) {
    throw new Error('Dedicated test database required');
  }
  const db = new Client({ connectionString: url });
  await db.connect();

  const adminEmail = `support-${randomUUID()}@example.test`;
  const adminId = randomUUID();

  try {
    // Create dedicated platform administrator
    await db.query(
      'INSERT INTO users(id,email,password_hash) SELECT $1,$2,password_hash FROM users WHERE email=$3',
      [adminId, adminEmail, 'owner@example.test'],
    );
    await db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      adminId,
    ]);

    // 1. Owner logs in and opens Platform Access page
    const ownerContext = await browser.newContext();
    await ownerContext.addCookies(await ownerCookies(browser));
    const ownerPage = await ownerContext.newPage();

    for (const width of [390, 768, 1440]) {
      await ownerPage.setViewportSize({ width, height: 900 });
      await ownerPage.goto(`/seller/${shop}/platform-access`);
      await expect(
        ownerPage.getByRole('heading', { name: 'Доступ платформы' }),
      ).toBeVisible();
      expect(
        await ownerPage.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }

    // Owner fills grant form
    await ownerPage
      .getByLabel('Email администратора платформы')
      .fill(adminEmail);
    await ownerPage
      .getByLabel('Цель доступа')
      .fill('Диагностика расхождения отчёта');
    await ownerPage
      .getByLabel('Срок доступа (в часах, от 1 до 168)')
      .fill('48');

    await ownerPage
      .getByRole('button', { name: 'Предоставить доступ' })
      .click();

    // Verify grant appears in table
    await expect(ownerPage.getByText(adminEmail)).toBeVisible();
    await expect(
      ownerPage.getByText('Диагностика расхождения отчёта'),
    ).toBeVisible();
    await expect(ownerPage.getByText('Активен')).toBeVisible();
    const revokeBtn = ownerPage.getByRole('button', { name: 'Отозвать' });
    await expect(revokeBtn).toBeVisible();

    // 2. Platform Admin logs in and opens Financial Access section
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await adminPage.goto('/seller/login');
    await adminPage.getByLabel('Email', { exact: true }).fill(adminEmail);
    await adminPage
      .getByLabel('Пароль', { exact: true })
      .fill('browser-test-password');
    await adminPage.getByRole('button', { name: 'Войти', exact: true }).click();
    await adminPage.waitForURL((u) => !u.pathname.endsWith('/seller/login'));

    await adminPage.goto('/platform/admin?section=financial-access');
    await expect(
      adminPage.getByRole('heading', { name: 'Финансовый доступ платформы' }),
    ).toBeVisible();
    await expect(adminPage.getByText('MyStore Demo')).toBeVisible();
    await expect(
      adminPage.getByText('Диагностика расхождения отчёта'),
    ).toBeVisible();

    // Admin opens summary
    await adminPage.getByRole('button', { name: 'Открыть сводку' }).click();
    await expect(
      adminPage.getByText('Финансовая сводка: MyStore Demo'),
    ).toBeVisible();
    await expect(
      adminPage.getByText('Выручка за вычетом возвратов'),
    ).toBeVisible();
    await expect(adminPage.getByText('Валовая прибыль')).toBeVisible();
    await expect(adminPage.getByText(/Режим аудируемого чтения/)).toBeVisible();

    // Verify audit record was created
    const [{ count }] = (
      await db.query(
        "SELECT count(*)::int FROM audit_log WHERE shop_id=$1 AND action='platform-access:read' AND actor_id=$2",
        [shop, adminId],
      )
    ).rows;
    expect(count).toBeGreaterThanOrEqual(1);

    // 3. Owner revokes the grant
    await revokeBtn.click();
    await expect(ownerPage.getByText('Отозван')).toBeVisible();
    await expect(
      ownerPage.getByRole('button', { name: 'Отозвать' }),
    ).toHaveCount(0);

    // 4. Admin reloads and verifies revoked status
    await adminPage.reload();
    await expect(adminPage.getByText('Отозван')).toBeVisible();
    await expect(
      adminPage.getByRole('button', { name: 'Открыть сводку' }),
    ).toHaveCount(0);

    await ownerContext.close();
    await adminContext.close();
  } finally {
    try {
      await db.query(
        'DELETE FROM platform_financial_grants WHERE admin_user_id=$1',
        [adminId],
      );
      await db.query(
        "DELETE FROM audit_log WHERE action LIKE 'platform-access:%' AND actor_id=$1",
        [adminId],
      );
      await db.query('DELETE FROM platform_admins WHERE user_id=$1', [adminId]);
      await db.query('DELETE FROM users WHERE id=$1', [adminId]);
    } catch {}
    await db.end();
  }
});
