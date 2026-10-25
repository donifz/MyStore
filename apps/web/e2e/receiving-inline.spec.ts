import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { ownerCookies } from './owner-session';
const shop = '11111111-1111-4111-8111-111111111111';
for (const width of [390, 1440]) {
  test(`unknown barcode is created inside the receipt and changes stock only when posted at ${width}px`, async ({
    page,
    context,
    browser,
  }) => {
    await context.addCookies(await ownerCookies(browser));
    await page.setViewportSize({ width, height: 1000 });
    const tag = randomUUID().slice(0, 8),
      barcode = '000' + tag,
      knownBarcode = '001' + tag;
    await page.goto(`/seller/${shop}/receiving`);
    const created = await page.evaluate(
      async ({ shop, knownBarcode }) => {
        const me = await (await fetch('/api/auth/me')).json();
        const response = await fetch(`/api/shops/${shop}/variants`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-csrf-token': me.csrfToken,
            'idempotency-key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            name: 'Известный товар',
            barcode: knownBarcode,
            salePriceMinor: 10000,
          }),
        });
        if (!response.ok) throw new Error('Fixture creation failed');
        return await response.json();
      },
      { shop, knownBarcode },
    );
    const scanner = page.getByLabel('Сканировать штрихкод');
    await scanner.fill(knownBarcode);
    await scanner.press('Enter');
    await expect(page.getByLabel('Количество Известный товар')).toHaveValue(
      '1',
    );
    await page.getByLabel('Количество Известный товар').fill('2');
    await page.getByLabel('Закупочная цена Известный товар, сом').fill('50');
    await scanner.fill(barcode);
    await scanner.press('Enter');
    await page
      .getByRole('button', { name: 'Создать товар с этим штрихкодом' })
      .click();
    const form = page.getByRole('form', { name: 'Новый товар в приёмке' });
    await expect(form.getByLabel('Штрихкод')).toHaveValue(barcode);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole('button', { name: 'Провести приёмку', exact: true }),
    ).toBeDisabled();
    await form.getByLabel('Название').fill('Принтер ' + tag);
    await form.getByLabel('Цена продажи, сом').fill('2000');
    await form
      .getByRole('button', { name: 'Создать и добавить в приёмку' })
      .click();
    await expect(form).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/seller/${shop}/receiving$`));
    await expect(page.getByLabel('Количество Принтер ' + tag)).toHaveValue('1');
    await expect(page.getByLabel('Количество Известный товар')).toHaveValue(
      '2',
    );
    async function balance(code: string) {
      return await page.evaluate(
        async ({ shop, code }) => {
          const response = await fetch(
            `/api/shops/${shop}/variants?q=${encodeURIComponent(code)}&pageSize=100`,
          );
          if (!response.ok) throw new Error('Stock lookup failed');
          const data = await response.json();
          const variant = data.items.find(
            (item: { barcode: string }) => item.barcode === code,
          );
          if (!variant) throw new Error('Stock item missing');
          return variant;
        },
        { shop, code },
      );
    }
    expect((await balance(barcode)).physical).toBe(0);
    expect((await balance(knownBarcode)).physical).toBe(0);
    await page.getByLabel('Количество Принтер ' + tag).fill('5');
    await page
      .getByLabel('Закупочная цена Принтер ' + tag + ', сом')
      .fill('1500');
    await page.reload();
    await expect(page.getByLabel('Количество Принтер ' + tag)).toHaveValue('5');
    await expect(
      page.getByLabel('Закупочная цена Известный товар, сом'),
    ).toHaveValue('50');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('button', { name: 'Провести приёмку', exact: true })
      .click();
    await expect(page.getByRole('status')).toContainText('Документ проведён');
    const added = await balance(barcode),
      known = await balance(knownBarcode);
    expect(added.physical).toBe(5);
    expect(added.stockValueMinor).toBe(750000);
    expect(known.id).toBe(created.id);
    expect(known.physical).toBe(2);
    expect(known.stockValueMinor).toBe(10000);
  });
}
