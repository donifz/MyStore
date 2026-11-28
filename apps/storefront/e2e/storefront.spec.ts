import { test, expect } from '@playwright/test';
const id = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
for (const width of [320, 390, 768, 980, 1024, 1185, 1200, 1440]) {
  test(`catalog has a usable grid without overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/?q=long');
    await expect(
      page.getByRole('heading', { name: 'Все товары' }),
    ).toBeVisible();
    const columns = await page
      .locator('.sf-product-grid')
      .evaluate(
        (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
      );
    expect(columns).toBe(
      width <= 350 ? 1 : width < 1100 ? 2 : width < 1380 ? 3 : 4,
    );
    const docScrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const winInnerWidth = await page.evaluate(() => window.innerWidth);
    const docClientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    console.log(
      `WIDTH ${width}px -> scrollWidth: ${docScrollWidth}, innerWidth: ${winInnerWidth}, clientWidth: ${docClientWidth}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const filters = page.locator('.sf-catalog-sidebar details');
    await expect(filters).toHaveJSProperty('open', width >= 1100);
    if (width <= 600) {
      const card = page.locator('.sf-product-card').first();
      expect((await card.boundingBox())!.width).toBeGreaterThan(
        width <= 350 ? width - 48 : width * 0.4,
      );
      await expect(page.getByLabel('Поиск', { exact: true })).toBeHidden();
      await filters.locator('summary').click();
    } else if (width < 1100) {
      const card = page.locator('.sf-product-card').first();
      expect((await card.boundingBox())!.width).toBeGreaterThan(width * 0.4);
      await expect(page.getByLabel('Поиск', { exact: true })).toBeHidden();
      await filters.locator('summary').click();
    } else {
      const card = page.locator('.sf-product-card').first();
      expect((await card.boundingBox())!.width).toBeGreaterThan(220);
    }
    await expect(page.getByLabel('Поиск', { exact: true })).toBeVisible();
  });
}
test('shows a placeholder instead of a broken image when the photo is corrupt', async ({
  page,
}) => {
  await page.goto('/?q=broken-image');
  const card = page.locator('.sf-product-card').first();
  await expect(card).toBeVisible();
  // Product cards use loading="lazy": the browser may not request a corrupt
  // image until its card enters the viewport.
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator('.sf-product-placeholder')).toBeVisible();
  await expect(card.locator('img')).toHaveCount(0);
});

test('home shows stores showcase above available products', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Товары в наличии' }),
  ).toBeVisible();
  await expect(page.locator('.sf-home-hero')).toBeVisible();
  await expect(page.locator('.sf-product-card')).toHaveCount(1);
  await expect(
    page.getByRole('link', { name: 'Сбросить', exact: true }),
  ).toHaveAttribute('href', '/?inStock=false#catalog');
  await expect(
    page.getByRole('heading', { name: 'Магазины рядом' }),
  ).toBeVisible();
  await expect(
    page.locator('.sf-stores-strip .sf-home-store-card'),
  ).toHaveCount(1);
  await expect(
    page.locator('.sf-home-store-card__cover-img').first(),
  ).toBeVisible();
  const storeCardBox = await page
    .locator('.sf-home-store-card')
    .first()
    .boundingBox();
  expect(storeCardBox!.width).toBeLessThan(450);
  const catalog = await page.locator('#catalog').boundingBox();
  const stores = await page.locator('.sf-stores-strip').boundingBox();
  expect(stores!.y).toBeLessThan(catalog!.y);
  await page
    .getByRole('navigation', { name: 'Наличие товаров' })
    .getByRole('link', { name: 'Все товары' })
    .click();
  await expect(page.getByRole('heading', { name: 'Все товары' })).toBeVisible();
});
test('mobile filters open by keyboard and retain active criteria', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?q=layout&inStock=true');
  const filters = page.locator('.sf-catalog-sidebar details');
  await expect(filters.locator('summary')).toContainText('Выбрано: 2');
  await expect(filters).toHaveJSProperty('open', false);
  await filters.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Поиск', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Поиск', { exact: true })).toHaveValue('layout');
  await expect(page.getByLabel('В наличии')).toBeChecked();
  await filters.locator('summary').click();
  await expect(filters).toHaveJSProperty('open', false);
});
test('desktop-site viewport keeps tablet filters usable', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 720 });
  await page.goto('/?q=layout&inStock=true');
  const filters = page.locator('.sf-catalog-sidebar details');
  await expect(filters.locator('summary')).toContainText('Выбрано: 2');
  await expect(filters).toHaveJSProperty('open', false);
  await filters.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Поиск', { exact: true })).toHaveValue('layout');
  await expect(page.getByLabel('В наличии')).toBeChecked();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('pagination preserves the selected filters', async ({ page }) => {
  await page.goto('/?q=чашка&category=Посуда&sort=price-asc&inStock=true');
  await page.getByRole('link', { name: 'Следующая страница' }).click();
  await expect(page).toHaveURL(/page=2/);
  const url = new URL(page.url());
  expect(url.searchParams.get('q')).toBe('чашка');
  expect(url.searchParams.get('category')).toBe('Посуда');
  expect(url.searchParams.get('sort')).toBe('price-asc');
  expect(url.searchParams.get('inStock')).toBe('true');
  await expect(
    page.getByRole('heading', { name: 'На этой странице товаров нет' }),
  ).toBeVisible();
});
test('uses canonical shop routes and renders the store banner', async ({
  page,
}) => {
  await page.goto('/shops/shop-a?category=Посуда');
  await expect(page).toHaveURL(/\/shop\/shop-a\?category=/);
  await expect(page.locator('.sf-store-banner')).toBeVisible();
  await expect(page.locator('.sf-store-banner img')).toBeVisible();
  await page.goto(
    '/shops/shop-a/products/11111111-1111-4111-8111-111111111111',
  );
  await expect(page.locator('.sf-store-banner')).toHaveCount(0);
});
test('product with no phone has no broken contact link and sold-out product cannot be added', async ({
  page,
}) => {
  await page.goto('/shops/no-phone/products/' + id);
  await expect(page.locator('a[href^="tel:"]')).toHaveCount(0);
  await page.goto('/shops/shop-a/products/sold-out');
  await expect(
    page.getByRole('button', { name: 'Нет в наличии' }),
  ).toBeDisabled();
});
test('navigation and cart survive mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shops');
  await page.getByRole('link', { name: /Магазин у дома/ }).click();
  await page
    .getByRole('heading', { name: 'Керамическая чашка', exact: true })
    .getByRole('link')
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Корзина', exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Ваше имя')).toBeVisible();
  await page.getByLabel('Количество Керамическая чашка').fill('2');
  await expect(page.getByText(/480/).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('an unknown checkout result blocks editing and resubmission until recovery', async ({
  page,
}) => {
  let recover = false;
  const sent: any[] = [];
  await page.route('**/api/public/orders', async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      status: 503,
      body: '{}',
      contentType: 'application/json',
    });
  });
  await page.route('**/api/public/orders/receipt', (route) =>
    route.fulfill({
      status: recover ? 200 : 503,
      contentType: 'application/json',
      body: recover
        ? JSON.stringify({
            id: 'receipt-1',
            status: 'new',
            totalMinor: 24000,
            expiresAt: null,
            storeName: 'Магазин у дома',
          })
        : '{}',
    }),
  );
  await page.goto('/shops/shop-a/products/' + id);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Результат пока неизвестен',
  );
  await expect(page.getByLabel('Количество Керамическая чашка')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Подтвердить заказы', exact: true }),
  ).toBeDisabled();
  expect(sent).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel('Количество Керамическая чашка')).toBeDisabled();
  const pending = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!).attempts[
        'shop-a'
      ],
  );
  expect(pending).toEqual(sent[0]);
  recover = true;
  await page
    .getByRole('button', { name: 'Проверить / повторить заказ', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
});
test('empty and failed catalogs provide usable states', async ({ page }) => {
  await page.goto('/?q=empty');
  await expect(
    page.getByRole('heading', { name: 'Ничего не найдено' }),
  ).toBeVisible();
  await page.goto('/?q=outage');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Не удалось загрузить каталог',
  );
  await expect(page.getByRole('link', { name: 'Повторить' })).toBeVisible();
});

test('multi-store checkout preserves successful groups and retries rejected groups independently', async ({
  page,
}) => {
  const requests: any[] = [];
  let acceptSecond = false;
  await page.route('**/api/public/orders', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const rejected = body.storeSlug === 'no-phone' && !acceptSecond;
    await route.fulfill({
      status: rejected ? 409 : 201,
      contentType: 'application/json',
      body: JSON.stringify(
        rejected
          ? { message: 'Insufficient available stock', available: 0 }
          : {
              id: body.storeSlug === 'shop-a' ? 'success-a' : 'success-b',
              status: 'new',
              totalMinor: 24000,
              expiresAt: null,
              storeName:
                body.storeSlug === 'shop-a'
                  ? 'Магазин у дома'
                  : 'Магазин без телефона',
            },
      ),
    });
  });
  await page.goto('/shops/shop-a/products/' + id);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await expect(
    page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('link', { name: /Перейти в корзину/ }),
  ).toBeVisible();
  await page.goto('/shops/no-phone/products/' + secondId);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(2);
  await page.getByLabel('Ваше имя').fill('Алия');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Ваши заказы', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(1);
  await expect(page.locator('.sf-order-receipt')).toHaveCount(1);
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Изменилось наличие',
  );
  expect(requests.map((r) => r.storeSlug)).toEqual(['shop-a', 'no-phone']);
  expect(requests[0].lines).toEqual([
    { variantId: id, quantity: 1, expectedUnitPriceMinor: 24000 },
  ]);
  expect(requests[1].lines).toEqual([
    { variantId: secondId, quantity: 1, expectedUnitPriceMinor: 24000 },
  ]);
  for (const request of requests)
    expect(request.checkoutKey).toMatch(/^[\da-f-]{36}$/);
  expect(requests[0].checkoutKey).not.toBe(requests[1].checkoutKey);
  acceptSecond = true;
  await page
    .getByRole('button', { name: 'Подтвердить заказы', exact: true })
    .click();
  await expect(page.locator('.sf-cart-shop')).toHaveCount(0);
  await expect(page.locator('.sf-order-receipt')).toHaveCount(2);
  expect(requests.map((r) => r.storeSlug)).toEqual([
    'shop-a',
    'no-phone',
    'no-phone',
  ]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('mystore-marketplace-cart-v2')!).items,
    ),
  ).toEqual([]);
});

test('partner form submits the same data and announces success', async ({
  page,
}) => {
  const shopTypes = [
    { code: 'general', name: 'Универсальный магазин' },
    { code: 'toys', name: 'Игрушки' },
    { code: 'grocery', name: 'Продукты питания' },
    { code: 'fashion', name: 'Одежда и обувь' },
    { code: 'electronics', name: 'Электроника' },
    { code: 'home', name: 'Товары для дома' },
  ];
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/partners/shop-types', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(shopTypes),
    }),
  );
  await page.route('**/api/partners/applications', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.goto('/partner');
  await expect(page.getByText('30 дней бесплатно · Без карты')).toBeVisible();
  await expect(
    page.getByRole('heading', {
      name: 'Касса, учёт и витрина в одном месте',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText('Касса, чеки и USB-сканер')).toBeVisible();
  await expect(page.getByText('Остатки, смены и чистая прибыль')).toBeVisible();
  await expect(page.getByText('Готовая онлайн-витрина магазина')).toBeVisible();
  await expect(
    page.getByText('Заявка за 1 минуту → ссылка на вход в WhatsApp'),
  ).toBeVisible();
  await expect(page.getByText('С WhatsApp')).toBeVisible();
  await expect(page.getByText('Необязательно')).toBeVisible();
  await page.getByLabel('Название магазина').fill('Мастерская');
  await page.getByLabel('Email', { exact: true }).fill('example@example.test');
  await page.getByLabel('Телефон', { exact: true }).fill('+996700123456');
  await page
    .getByRole('main')
    .getByLabel('Город', { exact: true })
    .fill('Бишкек');
  const shopTypeSelect = page.getByLabel('Категория бизнеса');
  await expect(shopTypeSelect.locator('option')).toHaveText([
    'Выберите тип магазина',
    ...shopTypes.map((type) => type.name),
  ]);
  await shopTypeSelect.selectOption('home');
  await expect(shopTypeSelect).toHaveValue('home');
  await page.getByLabel('Согласен с условиями подключения').check();
  await page
    .getByRole('button', { name: 'Попробовать 30 дней бесплатно' })
    .click();
  await expect
    .poll(() => submitted)
    .toEqual({
      shopName: 'Мастерская',
      email: 'example@example.test',
      phone: '+996700123456',
      city: 'Бишкек',
      address: '',
      category: 'Товары для дома',
      shopType: 'home',
      agreed: true,
    });
  await expect(page.getByRole('main').getByRole('status')).toContainText(
    'Заявка отправлена',
  );
});

test('page templates stay within the viewport and provide QA screenshots', async ({
  page,
}, testInfo) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ['catalog', '/'],
      ['product', '/shops/shop-a/products/' + id],
      ['ui-kit', '/ui-kit'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('main')).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(name + '-' + width + '.png'),
        fullPage: true,
      });
    }
    await page.goto('/shops/shop-a/products/' + id);
    await page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('button', { name: 'В корзину', exact: true })
      .click();
    await page
      .getByRole('complementary', { name: 'Покупка товара' })
      .getByRole('link', { name: /Перейти в корзину/ })
      .click();
    await expect(
      page.getByRole('heading', { name: 'Корзина', exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('cart-' + width + '.png'),
      fullPage: true,
    });
  }
});

test('product layout stays readable in phone, desktop-site and desktop viewports', async ({
  page,
}) => {
  for (const width of [390, 980, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shops/shop-a/products/' + id);
    await expect(
      page.getByRole('heading', { name: 'Керамическая чашка', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'В избранное: Керамическая чашка' }),
    ).toBeVisible();
    const gallery = (await page.locator('.sf-gallery').boundingBox())!;
    const purchase = (await page.locator('.sf-purchase-panel').boundingBox())!;
    const description = (await page.locator('.sf-detail-copy').boundingBox())!;
    if (width < 1100) {
      expect(gallery.width).toBeGreaterThan(width * 0.75);
      expect(purchase.y).toBeGreaterThan(gallery.y + gallery.height);
      expect(description.y).toBeGreaterThan(purchase.y + purchase.height);
    } else {
      expect(purchase.x).toBeGreaterThan(gallery.x + gallery.width);
    }
    const related = page.locator('.sf-related-grid');
    await expect(related.locator('.sf-product-card')).toHaveCount(1);
    const columns = await related.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    );
    expect(columns).toBe(width <= 600 ? 1 : width < 1100 ? 2 : 4);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test('long store names fit store, product and cart at 320px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/shops/long-store');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Магазин',
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(
    await page
      .getByRole('heading', { level: 1 })
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
  await page
    .getByRole('heading', { name: 'Керамическая чашка', exact: true })
    .getByRole('link')
    .click();
  await expect(
    page.getByRole('heading', { name: 'Керамическая чашка', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('button', { name: 'В корзину', exact: true })
    .click();
  await page
    .getByRole('complementary', { name: 'Покупка товара' })
    .getByRole('link', { name: /Перейти в корзину/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Корзина', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('product descriptions preserve seller line breaks', async ({ page }) => {
  await page.goto('/shops/shop-a/products/' + id);
  expect(await page.locator('.sf-product-description').innerText()).toBe(
    'Для вашего любимого кофе.\nОбъём: 250 мл.',
  );
});

test('buyer can reach partner form through the footer', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('link', { name: 'Стать партнёром', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Стать партнёром', exact: true }),
  ).toBeVisible();
});

test('top navigation highlights the active section route and sort tab', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Разделы витрины' });
  const cases = [
    { url: '/', active: 'Главная' },
    { url: '/shops', active: 'Магазины' },
    { url: '/catalog', active: 'Каталог' },
    { url: '/?sort=price-asc#catalog', active: 'Акции' },
    { url: '/?sort=newest#catalog', active: 'Новинки' },
  ];
  for (const c of cases) {
    await page.goto(c.url);
    const activeLinks = nav.locator('.sf-top-nav__item--active');
    await expect(activeLinks).toHaveCount(1);
    await expect(activeLinks).toHaveText(c.active);
    await expect(activeLinks).toHaveAttribute('aria-current', 'page');
  }
});

test('orders pages do not show hardcoded mock orders and link to buyer cabinet', async ({
  page,
}) => {
  await page.goto('/orders');
  await expect(
    page.getByRole('heading', { name: 'Заказов пока нет', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('38472');
  await expect(page.getByRole('main')).not.toContainText('Мир игрушек');
  await expect(
    page.getByRole('link', { name: 'Личный кабинет', exact: true }),
  ).toHaveAttribute('href', '/buyer');

  await page.goto('/orders/missing-order');
  await expect(
    page.getByRole('heading', {
      name: 'Заказ не найден в локальной истории',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByRole('main')).not.toContainText('Плюшевый мишка');
  await expect(page.getByRole('main')).not.toContainText('Берекет');
});

test('catalog category strips scroll cleanly, avoid fake counts/ratings, and keep mobile icon cart compact', async ({
  page,
}) => {
  await page.setViewportSize({ width: 440, height: 956 });
  await page.goto('/');
  await expect(page.locator('.sf-filter-count')).toHaveCount(0);
  const quickStrip = page.getByRole('navigation', {
    name: 'Быстрый выбор категории',
  });
  await expect(quickStrip).toBeVisible();
  await expect(quickStrip.locator('.sf-quick-chip--more')).toHaveCount(0);
  await expect(quickStrip).not.toContainText('1 товаров');

  const mobileNav = page.getByRole('navigation', {
    name: 'Мобильная навигация',
  });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav.getByRole('link', { name: 'Заказы' })).toHaveCount(0);
  await expect(
    mobileNav.getByRole('link', { name: 'Магазины', exact: true }),
  ).toHaveAttribute('href', '/shops');

  await page.goto('/shop/shop-a');
  const storeTiles = page.getByRole('navigation', {
    name: 'Категории магазина',
  });
  await expect(storeTiles).toBeVisible();
  await expect(storeTiles.locator('.sf-store-cat-tile--more')).toHaveCount(0);
  await expect(
    storeTiles.getByRole('link', { name: 'Все товары' }),
  ).toBeVisible();
  const tilesLayout = await storeTiles.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { display: cs.display, overflowX: cs.overflowX };
  });
  expect(tilesLayout.display).toBe('flex');
  expect(['auto', 'scroll']).toContain(tilesLayout.overflowX);

  const phoneLink = page.locator('.sf-store-phone-link');
  await expect(phoneLink).toBeVisible();
  const phoneColor = await phoneLink.evaluate(
    (el) => getComputedStyle(el).color,
  );
  expect(phoneColor).toBe('rgb(71, 85, 105)');

  const iconCartBtn = page
    .locator('.sf-product-grid--store .sf-icon-cart-btn')
    .first();
  await expect(iconCartBtn).toBeVisible();
  const btnWidth = await iconCartBtn.evaluate(
    (el) => el.getBoundingClientRect().width,
  );
  expect(btnWidth).toBeLessThanOrEqual(52);

  await page.goto(
    '/shops/shop-a/products/11111111-1111-4111-8111-111111111111',
  );
  const sellerStats = page.locator('.sf-seller-stats');
  await expect(sellerStats).not.toContainText('5,0');
  await expect(sellerStats).toContainText('Пока нет отзывов');
});

test('shops directory displays hero, quick filters, rich store cards, and partner CTA without overflow', async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/shops');

    await expect(page.locator('.sf-shops-hero')).toBeVisible();
    await expect(page.locator('.sf-shops-hero h1')).toContainText(
      'Магазины вашего города',
    );
    await expect(page.locator('.sf-partner-cta-card')).toBeVisible();
    await expect(
      page.locator('.sf-partner-cta-card a[href="/partner"]'),
    ).toBeVisible();
    await expect(page.locator('.sf-partner-cta-card__note')).toHaveText(
      'Пробный период 30 дней бесплатно · Без привязки карты',
    );

    const storeCards = page.locator(
      '.sf-store-list-grid .sf-store-card--modern',
    );
    if ((await storeCards.count()) > 0) {
      await expect(storeCards.first()).toBeVisible();
      await expect(
        storeCards.first().locator('.sf-home-store-card__cta'),
      ).toBeVisible();
    }

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
