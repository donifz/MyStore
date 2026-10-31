import { test, expect, APIRequestContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { approveProduct, reviewedPartner } from './review-fixtures';

test('shopper checkout recovers receipt and seller issues reserved stock once', async ({
  page,
  request,
}) => {
  const email = `orders-${randomUUID()}@example.test`,
    password = 'orders-browser-password';
  const token = await reviewedPartner(
    request,
    email,
    password,
    'Заказы у дома',
  );
  const headers = { authorization: `Bearer ${token}` };
  const me = await (await request.get('/api/auth/me', { headers })).json(),
    shop = me.shops[0].id;
  const profile = await (
    await request.put(`/api/shops/${shop}/storefront`, {
      headers,
      data: {
        description: '',
        city: 'Ош',
        address: 'Центр',
        phone: '+996700123456',
        hours: '',
        deliveryEnabled: true,
        published: true,
      },
    })
  ).json();
  const variant = await (
    await request.post(`/api/shops/${shop}/variants`, {
      headers: { ...headers, 'idempotency-key': randomUUID() },
      data: { name: 'Чашка для заказа', salePriceMinor: 15000 },
    })
  ).json();
  await approveProduct(request, variant.id);
  expect(
    (
      await request.post(`/api/shops/${shop}/receivings`, {
        headers: { ...headers, 'idempotency-key': randomUUID() },
        data: {
          lines: [{ variantId: variant.id, quantity: 5, unitCostMinor: 8000 }],
        },
      })
    ).ok(),
  ).toBeTruthy();
  await page.goto(`/shops/${profile.slug}/products/${variant.id}`);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .locator('header')
    .getByRole('link', { name: /^Корзина/ })
    .click();
  await page.getByLabel('Количество Чашка для заказа').fill('2');
  await page.getByLabel('Ваше имя').fill('Покупатель тест');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700333333');
  await page
    .locator('.sf-cart-shop')
    .getByRole('radio', { name: /Доставка/ })
    .check();
  await page.getByLabel('Адрес доставки').fill('Адрес покупателя');
  await page.route('**/api/public/orders', async (route) => {
    await route.fetch();
    await route.abort('failed');
  });
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Результат пока неизвестен' }),
  ).toBeVisible();
  await page.unroute('**/api/public/orders');
  await page.reload();
  await page
    .getByRole('button', { name: 'Проверить / повторить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    [...Object.values(localStorage), ...Object.values(sessionStorage)].join(
      ' ',
    ),
  );
  expect(stored).not.toContain('Покупатель тест');
  expect(stored).not.toContain('Адрес покупателя');
  expect(stored).not.toContain('333333');
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
  await page.goto(`/shops/${profile.slug}/products/${variant.id}`);
  await expect(page.getByText('В наличии: 3 шт.')).toBeVisible();
  await page.goto('/seller/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.endsWith('/seller/login'));
  await page
    .getByRole('navigation', { name: 'Разделы кабинета' })
    .getByText('Ещё', { exact: true })
    .click();
  await page.getByRole('link', { name: 'Заказы', exact: true }).click();
  await page
    .getByRole('button', { name: /Открыть заказ/ })
    .first()
    .click();
  await expect(
    page.getByText('Адрес покупателя', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await page
    .getByRole('button', { name: 'Готов к выдаче', exact: true })
    .click();
  await page.getByRole('link', { name: 'Смена', exact: true }).click();
  await page
    .getByRole('button', { name: 'Открыть смену', exact: true })
    .click();
  await page.getByRole('link', { name: 'Заказы', exact: true }).click();
  await page
    .getByRole('button', { name: /Открыть заказ/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Выдать и провести продажу', exact: true })
    .click();
  await expect(page.getByText('Выдан', { exact: true }).last()).toBeVisible();
  const stock = await (
    await request.get(`/api/shops/${shop}/stock/${variant.id}`, { headers })
  ).json();
  expect(stock.physical).toBe(3);
  expect(stock.reserved).toBe(0);
  const shift = await (
    await request.get(`/api/shops/${shop}/pos/shifts/current`, { headers })
  ).json();
  expect(shift.salesCashMinor).toBe(30000);
  const cancellation = await request.post('/api/public/orders', {
    headers: { origin: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3001' },
    data: {
      checkoutKey: randomUUID(),
      storeSlug: profile.slug,
      name: 'Отмена',
      phone: '+996700666666',
      fulfillment: 'pickup',
      address: '',
      comment: '',
      lines: [
        { variantId: variant.id, quantity: 1, expectedUnitPriceMinor: 15000 },
      ],
    },
  });
  expect(cancellation.ok()).toBeTruthy();
  await page.goto(`/seller/${shop}/orders`);
  await page
    .getByRole('button', { name: /Открыть заказ/ })
    .first()
    .click();
  await page
    .getByRole('button', { name: 'Отменить заказ', exact: true })
    .click();
  await expect(page.getByText('Отменён', { exact: true })).toBeVisible();
  const restored = await (
    await request.get(`/api/shops/${shop}/stock/${variant.id}`, { headers })
  ).json();
  expect(restored.physical).toBe(3);
  expect(restored.reserved).toBe(0);
});

async function shopForCart(request: APIRequestContext, name: string) {
  const email = `cart-${randomUUID()}@example.test`,
    password = 'cart-browser-password';
  const token = await reviewedPartner(request, email, password, name),
    headers = { authorization: `Bearer ${token}` };
  const shop = (await (await request.get('/api/auth/me', { headers })).json())
    .shops[0].id;
  const profile = await (
    await request.put(`/api/shops/${shop}/storefront`, {
      headers,
      data: {
        description: '',
        city: 'Ош',
        address: '',
        phone: '+996700123456',
        hours: '',
        deliveryEnabled: true,
        published: true,
      },
    })
  ).json();
  const v = await (
    await request.post(`/api/shops/${shop}/variants`, {
      headers: { ...headers, 'idempotency-key': randomUUID() },
      data: { name, salePriceMinor: 15000 },
    })
  ).json();
  await approveProduct(request, v.id);
  await request.post(`/api/shops/${shop}/receivings`, {
    headers: { ...headers, 'idempotency-key': randomUUID() },
    data: { lines: [{ variantId: v.id, quantity: 5, unitCostMinor: 8000 }] },
  });
  return { shop, headers, v, url: `/shops/${profile.slug}/products/${v.id}` };
}
test('keeps the original checkout body and key after a rejected recovery retry', async ({
  page,
  request,
}) => {
  const a = await shopForCart(request, 'Повтор заказа');
  await page.goto(a.url);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .locator('header')
    .getByRole('link', { name: /^Корзина/ })
    .click();
  await page.getByLabel('Ваше имя').fill('Покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700555555');
  await page.route('**/api/public/orders', (route) => route.abort('failed'));
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Результат пока неизвестен' }),
  ).toBeVisible();
  const pending = await page.evaluate(
    () =>
      Object.values(
        JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!)
          .attempts,
      )[0],
  );
  await page.unroute('**/api/public/orders');
  await page.route('**/api/public/orders', (route) =>
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Price changed' }),
    }),
  );
  await page
    .getByRole('button', { name: 'Проверить / повторить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Результат пока неизвестен' }),
  ).toBeVisible();
  await expect(page.getByLabel('Количество Повтор заказа')).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        Object.values(
          JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!)
            .attempts,
        )[0],
    ),
  ).toEqual(pending);
  await page.reload();
  await page.unroute('**/api/public/orders');
  let sent: unknown;
  await page.route('**/api/public/orders', async (route) => {
    sent = route.request().postDataJSON();
    await route.continue();
  });
  await page
    .getByRole('button', { name: 'Проверить / повторить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
  expect(sent).toEqual(pending);
  const stock = await (
    await request.get(`/api/shops/${a.shop}/stock/${a.v.id}`, {
      headers: a.headers,
    })
  ).json();
  expect(stock.physical).toBe(5);
  expect(stock.reserved).toBe(1);
});

test('multi-store checkout retains a rejected price group and never duplicates the successful order', async ({
  page,
  request,
}) => {
  const a = await shopForCart(request, 'Корзина А'),
    b = await shopForCart(request, 'Корзина Б');
  for (const shop of [a, b]) {
    await page.goto(shop.url);
    await page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('button', { name: 'В корзину', exact: true })
      .click();
    await expect(
      page
        .getByRole('complementary', { name: 'Покупка товара' })
        .getByRole('link', { name: /Перейти в корзину/ }),
    ).toBeVisible();
  }
  await page
    .locator('header')
    .getByRole('link', { name: /^Корзина/ })
    .click();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(2);
  const changed = await request.put(`/api/shops/${b.shop}/variants/${b.v.id}`, {
    headers: b.headers,
    data: {
      name: 'Корзина Б',
      salePriceMinor: 20000,
      description: '',
      category: '',
      published: true,
    },
  });
  expect(changed.ok()).toBeTruthy();
  await page.getByLabel('Ваше имя').fill('Покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700444444');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Цена изменилась' }),
  ).toBeVisible();
  await expect(page.locator('.sf-order-receipt')).toHaveCount(1);
  await expect(page.locator('.sf-cart-shop')).toHaveCount(1);
  const firstStock = await (
    await request.get(`/api/shops/${a.shop}/stock/${a.v.id}`, {
      headers: a.headers,
    })
  ).json();
  expect(firstStock.reserved).toBe(1);
  await page
    .getByRole('button', { name: 'Удалить Корзина Б', exact: true })
    .click();
  await page.goto(b.url);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .locator('header')
    .getByRole('link', { name: /^Корзина/ })
    .click();
  await page.getByLabel('Ваше имя').fill('Покупатель');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700444444');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(page.locator('.sf-order-receipt')).toHaveCount(2);
  await expect(page.locator('.sf-cart-shop')).toHaveCount(0);
  for (const shop of [a, b]) {
    const stock = await (
      await request.get(`/api/shops/${shop.shop}/stock/${shop.v.id}`, {
        headers: shop.headers,
      })
    ).json();
    expect(stock.physical).toBe(5);
    expect(stock.reserved).toBe(1);
  }
});
