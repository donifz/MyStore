import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('administrator approves a partner and a public card while the owner sees a pending draft', async ({
  page,
  request,
}) => {
  const email = `review-${randomUUID()}@example.test`;
  const applied = await request.post('/api/partners/applications', {
    headers: { origin: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001' },
    data: {
      shopName: 'Проверяемый магазин',
      email,
      phone: '+996700123456',
      city: 'Ош',
      address: 'Центр',
      category: 'Посуда',
      agreed: true,
    },
  });
  expect(applied.ok()).toBeTruthy();
  await page.goto('/platform/admin');
  await page.getByLabel('Email').fill('owner@example.test');
  await page.getByLabel('Пароль').fill('browser-test-password');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Администрирование MyStore' }),
  ).toBeVisible();
  const card = page.locator('article').filter({ hasText: email });
  await card.getByRole('button', { name: 'Одобрить', exact: true }).click();
  const link = await page.getByLabel('Ссылка активации').inputValue();
  expect(link).toMatch(/\/partner\/activate\?token=[a-f0-9]{64}$/);
  await page.goto(link);
  await page.getByLabel('Новый пароль').fill('review-browser-password');
  await page.getByRole('button', { name: 'Активировать кабинет' }).click();
  await expect(page.getByText('Кабинет активирован.')).toBeVisible();
  const login = await request.post('/api/auth/login', {
    data: { email, password: 'review-browser-password' },
  });
  expect(login.ok()).toBeTruthy();
  const headers = { authorization: `Bearer ${(await login.json()).token}` };
  const me = await (await request.get('/api/auth/me', { headers })).json();
  const shop = me.shops[0].id;
  const profile = await (
    await request.put(`/api/shops/${shop}/storefront`, {
      headers,
      data: {
        description: 'Посуда',
        city: 'Ош',
        address: 'Центр',
        phone: '+996700123456',
        hours: '',
        published: true,
      },
    })
  ).json();
  const product = await (
    await request.post(`/api/shops/${shop}/variants`, {
      headers,
      data: { name: 'Кружка для дома', salePriceMinor: 12000 },
    })
  ).json();
  expect(
    (
      await request.get(
        `/api/public/stores/${profile.slug}/products/${product.id}`,
      )
    ).status(),
  ).toBe(404);
  await page.goto('/platform/admin');
  await page.getByRole('button', { name: /Товары \(/ }).click();
  await page
    .locator('article')
    .filter({ hasText: 'Кружка для дома' })
    .getByRole('button', { name: 'Посмотреть изменения' })
    .click();
  const proposed = page.getByRole('heading', {
    name: 'Предложено: Кружка для дома',
  });
  await expect(proposed).toBeVisible();
  await page.getByRole('button', { name: 'Одобрить карточку' }).click();
  await expect(proposed).toHaveCount(0);
  expect(
    (
      await request.get(
        `/api/public/stores/${profile.slug}/products/${product.id}`,
      )
    ).status(),
  ).toBe(200);
});
