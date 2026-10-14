import { test, expect } from '@playwright/test';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { Client } from 'pg';
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { startSmtpServer } from '../../api/test/fixtures/smtp-server';
let smtp: Awaited<ReturnType<typeof startSmtpServer>>,
  worker: ChildProcess,
  db: Client;
const shop = randomUUID(),
  owner = randomUUID(),
  ownerEmail = `email-owner-${randomUUID()}@example.test`,
  password = 'browser-test-password';
const origin = process.env.E2E_BASE_URL || 'http://127.0.0.1:3001';
const key = Buffer.alloc(32, 7).toString('base64');
function mailLink(to: string, path: string) {
  const m = [...smtp.messages]
    .reverse()
    .find((m) => m.to === to && m.text.includes(path));
  if (!m) return '';
  const link = m.text.match(/https?:\/\/[^\s]+/)?.[0];
  if (!link) return '';
  const u = new URL(link);
  return u.pathname + u.search;
}
async function login(
  page: import('@playwright/test').Page,
  email: string,
  pwd = password,
) {
  await page.goto('/seller/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(pwd);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page.goto('/seller/' + shop + '/products');
  await expect(
    page.getByRole('heading', { name: 'Товары', exact: true }),
  ).toBeVisible();
}
test.beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL!;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Dedicated database required');
  db = new Client({ connectionString: url });
  await db.connect();
  const salt = randomBytes(16).toString('hex');
  const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  await db.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
    shop,
    'Email browser shop',
  ]);
  await db.query('INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)', [
    owner,
    ownerEmail,
    hash,
  ]);
  await db.query(
    "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
    [shop, owner],
  );
  smtp = await startSmtpServer();
  worker = spawn(
    process.execPath,
    [resolve(process.cwd(), '../api/dist/scripts/email-worker.js')],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        NODE_ENV: 'test',
        EMAIL_ENABLED: 'true',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(smtp.port),
        SMTP_SECURE: 'false',
        SMTP_FROM: 'mystore@example.test',
        PUBLIC_BASE_URL: origin,
        EMAIL_TOKEN_ENCRYPTION_KEY: key,
      },
      stdio: 'pipe',
    },
  );
  worker.stderr?.on('data', () => {});
});
test.afterAll(async () => {
  if (worker && worker.exitCode === null) {
    worker.kill('SIGTERM');
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.kill('SIGKILL');
        reject(new Error('worker failed graceful shutdown'));
      }, 35000);
      worker.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
  await smtp?.close();
  await db?.end();
});
for (const width of [390, 1440]) {
  test(
    'owner invites, employee accepts, recovers and loses access at ' +
      width +
      'px',
    async ({ page, browser }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 844 });
      await login(page, ownerEmail);
      await page.goto(`/seller/${shop}/staff`);
      await expect(
        page.getByRole('heading', { name: 'Сотрудники', exact: true }),
      ).toBeVisible();
      const email = `employee-${randomUUID()}@example.test`;
      await page.getByLabel('Email сотрудника').fill(email);
      await page.getByLabel('Роль', { exact: true }).selectOption('cashier');
      await page
        .getByRole('button', { name: 'Пригласить', exact: true })
        .click();
      await expect(page.getByText('Изменения сохранены.')).toBeVisible();
      await expect
        .poll(() => mailLink(email, '/seller/staff/accept'), { timeout: 15000 })
        .not.toBe('');
      const employee = await browser.newContext({
        baseURL: origin,
        viewport: { width, height: 844 },
      });
      const p = await employee.newPage();
      const link = mailLink(email, '/seller/staff/accept');
      const response = await p.goto(link);
      expect(response?.headers()['referrer-policy']).toBe('no-referrer');
      expect(response?.headers()['cache-control']).toContain('no-store');
      await expect(p).toHaveURL(origin + '/seller/staff/accept');
      await p.getByLabel('Пароль нового аккаунта').fill(password);
      await p
        .getByRole('button', { name: 'Принять приглашение', exact: true })
        .click();
      await expect(
        p.getByText('Приглашение принято. Доступ к магазину выдан.'),
      ).toBeVisible();
      await login(p, email);
      // Existing login must be rejected after recovery; emails are received through real compiled worker + SMTP fixture.
      await p.goto('/seller/forgot-password');
      await p.getByLabel('Email', { exact: true }).fill(email);
      await p
        .getByRole('button', { name: 'Отправить ссылку', exact: true })
        .click();
      await expect(p.getByRole('status')).toContainText('Если аккаунт');
      await expect
        .poll(() => mailLink(email, '/seller/reset-password'), {
          timeout: 15000,
        })
        .not.toBe('');
      await p.goto(mailLink(email, '/seller/reset-password'));
      await expect(p).toHaveURL(origin + '/seller/reset-password');
      await p.getByLabel('Новый пароль').fill('changed-browser-password');
      await p.getByRole('button', { name: 'Сохранить пароль' }).click();
      await expect(p.getByRole('status')).toContainText('Пароль изменён');
      expect((await employee.request.get('/api/auth/me')).status()).toBe(401);
      await login(p, email, 'changed-browser-password');
      await page.reload();
      await page.getByLabel('Роль ' + email).selectOption('manager');
      await expect(
        page.getByRole('status').filter({ hasText: 'Изменения сохранены' }),
      ).toBeVisible();
      page.once('dialog', (d) => d.accept());
      await page
        .locator('tr')
        .filter({ hasText: email })
        .getByRole('button', { name: 'Отключить', exact: true })
        .click();
      await expect(page.locator('tr').filter({ hasText: email })).toHaveCount(
        0,
      );
      expect(
        (await employee.request.get(`/api/shops/${shop}/access`)).status(),
      ).toBe(403);
      await page.goto(`/seller/${shop}/operations`);
      await expect(
        page.getByRole('heading', { name: 'Email-уведомления' }),
      ).toBeVisible();
      await page.getByLabel('Новые заказы', { exact: true }).uncheck();
      await page.getByRole('button', { name: 'Сохранить настройки' }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'Сохранено.' }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByLabel('Новые заказы', { exact: true }),
      ).not.toBeChecked();
      await page.getByRole('button', { name: 'Обновить отправки' }).click();
      await expect(
        page.getByText('Принято SMTP', { exact: true }).first(),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await employee.close();
    },
  );
}

test('checkout accepts email and worker sends the buyer the changed status', async ({
  page,
  request,
}) => {
  const logged = await request.post('/api/auth/login', {
    data: { email: ownerEmail, password },
  });
  expect(logged.ok()).toBeTruthy();
  const headers = {
    authorization: 'Bearer ' + (await logged.json()).token,
    'idempotency-key': randomUUID(),
  };
  const profile = await request.put(`/api/shops/${shop}/storefront`, {
    headers,
    data: {
      description: 'Email test shop',
      city: 'Ош',
      address: 'Центр',
      phone: '+996700123456',
      hours: '',
      published: true,
    },
  });
  expect(profile.ok()).toBeTruthy();
  const slug = (await profile.json()).slug;
  const v = await request.post(`/api/shops/${shop}/variants`, {
    headers,
    data: { name: 'Товар для email-заказа', salePriceMinor: 12000 },
  });
  expect(v.ok()).toBeTruthy();
  const variant = (await v.json()).id;
  await db.query(
    'INSERT INTO product_publications(variant_id,shop_id,name,description,category,subcategory,photo_data) SELECT id,shop_id,name,description,category,subcategory,photo_data FROM variants WHERE id=$1',
    [variant],
  );
  const received = await request.post(`/api/shops/${shop}/receivings`, {
    headers: { ...headers, 'idempotency-key': randomUUID() },
    data: { lines: [{ variantId: variant, quantity: 5, unitCostMinor: 7000 }] },
  });
  expect(received.ok()).toBeTruthy();
  await page.goto(`/shops/${slug}/products/${variant}`);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page.goto('/cart');
  const email = `buyer-${randomUUID()}@example.test`;
  await page.getByLabel('Ваше имя', { exact: true }).fill('Покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700987654');
  await page.getByLabel('Email (необязательно)', { exact: true }).fill(email);
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByText('Ожидает подтверждения магазина', { exact: true }),
  ).toBeVisible();
  const [order] = (
    await db.query(
      'SELECT id FROM online_orders WHERE shop_id=$1 AND email=$2',
      [shop, email],
    )
  ).rows;
  expect(order).toBeTruthy();
  const confirmed = await request.post(
    `/api/shops/${shop}/orders/${order.id}/status`,
    {
      headers: { ...headers, 'idempotency-key': randomUUID() },
      data: { status: 'confirmed' },
    },
  );
  expect(confirmed.ok()).toBeTruthy();
  await expect
    .poll(
      () =>
        smtp.messages.filter(
          (m) => m.to === email && m.text.includes('Статус: Подтверждён'),
        ).length,
      { timeout: 15000 },
    )
    .toBe(1);
  const message = smtp.messages.find(
    (m) => m.to === email && m.text.includes('Статус: Подтверждён'),
  )!;
  expect(message.text).toContain(order.id);
  expect(message.text).not.toContain('7000');
});

test('existing account signs in on the invitation screen without changing its password', async ({
  page,
  request,
}) => {
  const logged = await request.post('/api/auth/login', {
    data: { email: ownerEmail, password },
  });
  expect(logged.ok()).toBeTruthy();
  const headers = {
    authorization: 'Bearer ' + (await logged.json()).token,
    'idempotency-key': randomUUID(),
  };
  const invited = await request.post(`/api/shops/${shop}/staff/invitations`, {
    headers,
    data: { email: 'cashier@example.test', role: 'manager' },
  });
  expect(invited.ok()).toBeTruthy();
  await expect
    .poll(() => mailLink('cashier@example.test', '/seller/staff/accept'), {
      timeout: 15000,
    })
    .not.toBe('');
  await page.goto(mailLink('cashier@example.test', '/seller/staff/accept'));
  await page.getByLabel('У меня уже есть аккаунт MyStore').check();
  await page
    .getByLabel('Email приглашённого аккаунта')
    .fill('cashier@example.test');
  await page.getByLabel('Пароль аккаунта').fill(password);
  await page
    .getByRole('button', { name: 'Войти в приглашённый аккаунт' })
    .click();
  await expect(
    page.getByText('Вы вошли как cashier@example.test.', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Принять приглашение' }).click();
  await expect(
    page.getByText('Приглашение принято. Доступ к магазину выдан.'),
  ).toBeVisible();
  const me = await page.request.get('/api/auth/me');
  expect(me.ok()).toBeTruthy();
  expect((await me.json()).shops).toContainEqual({
    id: shop,
    name: 'Email browser shop',
    role: 'manager',
  });
  const loginAgain = await request.post('/api/auth/login', {
    data: { email: 'cashier@example.test', password },
  });
  expect(loginAgain.ok()).toBeTruthy();
});
