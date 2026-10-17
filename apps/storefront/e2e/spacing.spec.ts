import { test, expect } from '@playwright/test';
for (const width of [320, 390, 768, 1440]) {
  test(`catalog spacing and button rows stay consistent at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/?q=layout');
    const cards = page.locator('.sf-product-card');
    await expect(cards).toHaveCount(4);
    await expect(page.locator('.sf-hero-benefits')).toHaveCount(0);
    await expect(page.locator('.sf-market-art')).toBeVisible();
    const stripPadding = await page
      .locator('.sf-stores-strip')
      .evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    expect(stripPadding).toBeGreaterThanOrEqual(16);
    const gaps = await page.locator('.sf-product-grid').evaluate((el) => {
      const s = getComputedStyle(el);
      return { column: parseFloat(s.columnGap), row: parseFloat(s.rowGap) };
    });
    expect(gaps.column).toBeGreaterThanOrEqual(width >= 768 ? 16 : 8);
    expect(gaps.row).toBeGreaterThanOrEqual(16);
    const topPositions = () =>
      cards.evaluateAll((elements) =>
        elements.map((el) => {
          const r = el.getBoundingClientRect();
          const b = el
            .querySelector('.sf-buy-actions .sf-button')!
            .getBoundingClientRect();
          return {
            cardTop: Math.round(r.top + scrollY),
            buttonTop: b.top + scrollY,
            height: b.height,
          };
        }),
      );
    const before = await topPositions();
    for (const p of before) {
      expect(p.height).toBeGreaterThanOrEqual(44);
      for (const other of before.filter((x) => x.cardTop === p.cardTop))
        expect(Math.abs(p.buttonTop - other.buttonTop)).toBeLessThanOrEqual(1);
    }
    await cards
      .nth(0)
      .getByRole('button', { name: 'В корзину', exact: true })
      .click();
    await expect(
      cards.nth(0).getByRole('link', { name: /Перейти в корзину/ }),
    ).toBeVisible();
    expect(await topPositions()).toEqual(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/catalog-spacing-${width}.png`,
      fullPage: true,
    });
  });
}

test('compact recovery actions fit narrow cards and retain cart navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.addInitScript(() =>
    sessionStorage.setItem(
      'mystore-checkout-key',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ),
  );
  await page.goto('/?q=layout');
  const actions = page.locator('.sf-product-card .sf-buy-actions > .sf-button');
  await expect(actions).toHaveCount(4);
  for (const action of await actions.all()) {
    await expect(action).toHaveText('Проверить заказ');
    await expect(action).toHaveAttribute('href', '/cart');
    expect(
      await action.evaluate((el) => el.scrollWidth <= el.clientWidth),
    ).toBe(true);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
