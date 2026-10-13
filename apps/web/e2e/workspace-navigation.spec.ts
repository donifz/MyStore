import { test, expect, type Page } from '@playwright/test';
import { ownerCookies } from './owner-session';
import { Client } from 'pg';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
const shop = '11111111-1111-4111-8111-111111111111';
const password = 'browser-test-password';
const fixtureId = randomUUID();
const accounts = [
  'owner',
  'manager',
  'cashier',
  'empty',
  'mixed',
  'adminmixed',
].map((role) => ({
  role,
  id: randomUUID(),
  email: `workspace-${role}-${fixtureId}@example.test`,
}));
const secondShop = randomUUID();
test.beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL!;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error('Dedicated test database required');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    const salt = randomBytes(16).toString('hex'),
      hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
    await db.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
      secondShop,
      'Второй магазин ' + 'длинное название '.repeat(8),
    ]);
    for (const a of accounts) {
      await db.query(
        'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
        [a.id, a.email, hash],
      );
      if (a.role !== 'empty')
        await db.query(
          'INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,$3)',
          [
            shop,
            a.id,
            a.role === 'mixed'
              ? 'manager'
              : a.role === 'adminmixed'
                ? 'owner'
                : a.role,
          ],
        );
      if (a.role === 'mixed' || a.role === 'adminmixed')
        await db.query(
          "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'cashier')",
          [secondShop, a.id],
        );
    }
    const admin = accounts.find((a) => a.role === 'adminmixed')!;
    await db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      admin.id,
    ]);
  } finally {
    await db.end();
  }
});
async function login(page: Page, email: string) {
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
}
test('one account switches platform and shop while section survives refresh and history', async ({
  page,
  context,
  browser,
}) => {
  await context.addCookies(await ownerCookies(browser));
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/platform\/admin$/);
  const account = page.locator('.admin-kit-identity');
  await expect(account).toContainText('owner@example.test');
  const selector = () =>
    page.getByRole('combobox', { name: 'Рабочий контекст' });
  await selector().selectOption('shop:' + shop);
  await expect(page).toHaveURL(new RegExp(`/seller/${shop}/products$`));
  await expect(account).toContainText('owner@example.test');
  await expect(
    page.getByText('Рабочий кабинет', { exact: true }),
  ).toBeVisible();
  await selector().selectOption('platform');
  await page.getByRole('link', { name: 'Аудит', exact: true }).click();
  await expect(page).toHaveURL(/section=audit/);
  await page.reload();
  await expect(
    page.getByRole('link', { name: 'Аудит', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page
    .getByRole('link', { name: 'Модерация товаров', exact: true })
    .click();
  await page.goBack();
  await expect(
    page.getByRole('link', { name: 'Аудит', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('nav [aria-current="page"]')).toHaveCount(1);
  const active = page.getByRole('link', { name: 'Аудит', exact: true }),
    hover = page.getByRole('link', { name: 'Партнёры', exact: true });
  const activeColor = await active.evaluate(
    (e) => getComputedStyle(e).backgroundColor,
  );
  await hover.hover();
  expect(
    await hover.evaluate((e) => getComputedStyle(e).backgroundColor),
  ).not.toBe(activeColor);
  await page.goto('/seller#partner-shops');
  await expect(page).toHaveURL(/\/platform\/admin$/);
});
test('owner and manager start in products and cashier starts in their cash register', async ({
  browser,
}) => {
  for (const a of accounts.filter((a) =>
    ['owner', 'manager', 'cashier'].includes(a.role),
  )) {
    const context = await browser.newContext(),
      page = await context.newPage();
    try {
      await page.goto(
        (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001') + '/seller/login',
      );
      await page.getByLabel('Email').fill(a.email);
      await page.getByLabel('Пароль').fill(password);
      await page.getByRole('button', { name: 'Войти', exact: true }).click();
      await expect(page).toHaveURL(
        new RegExp(
          `/seller/${shop}/${a.role === 'cashier' ? 'pos' : 'products'}$`,
        ),
      );
      await expect(
        page.getByRole('combobox', { name: 'Рабочий контекст' }),
      ).toHaveValue('shop:' + shop);
      await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
      if (a.role !== 'owner') {
        await page.goto(
          (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001') +
            `/seller/${shop}/staff`,
        );
        await expect(page.getByRole('alert')).toContainText('Нет доступа');
      }
    } finally {
      await context.close();
    }
  }
});
test('mixed-role shops switch safely on phone, tablet and desktop without requesting owner reports', async ({
  page,
}) => {
  const a = accounts.find((a) => a.role === 'mixed')!,
    reports: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/reports/')) reports.push(r.url());
  });
  await login(page, a.email);
  await expect(page).toHaveURL(/\/seller\?view=shops$/);
  await expect(
    page.getByRole('heading', { name: 'Мои магазины', exact: true }),
  ).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page
      .getByRole('combobox', { name: 'Рабочий контекст' })
      .selectOption('shop:' + secondShop);
    await expect(page).toHaveURL(new RegExp(`/seller/${secondShop}/pos$`));
    await expect(page.getByText('Кассир', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('combobox', { name: 'Рабочий контекст' })
      .selectOption('shop:' + shop);
    await expect(page).toHaveURL(new RegExp(`/seller/${shop}/products$`));
  }
  expect(reports).toHaveLength(0);
  await page.goto('/seller/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pos');
  await expect(page.getByRole('alert')).toContainText('Нет доступа');
});
test('account without rights receives the common empty state and can leave', async ({
  page,
}) => {
  await login(page, accounts.find((a) => a.role === 'empty')!.email);
  await expect(page).toHaveURL(/\/seller\?view=shops$/);
  await expect(
    page.getByText('Доступ к магазину пока не выдан.'),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Рабочий контекст' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Выйти' }).click();
  await expect(page).toHaveURL(/\/seller\/login$/);
});

test('legacy multi-shop link retains its destination through administrator login', async ({
  page,
}) => {
  await page.goto('/seller#partner-shops');
  await expect(page).toHaveURL(/\/seller\/login$/);
  await page
    .getByLabel('Email')
    .fill(accounts.find((a) => a.role === 'adminmixed')!.email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/seller\?view=shops$/);
  await expect(
    page.getByRole('heading', { name: 'Мои магазины', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('combobox', { name: 'Рабочий контекст' }),
  ).toHaveValue('shops');
});
