import { test, expect } from '@playwright/test';
test('button defaults do not submit a form, and loading blocks actions', async ({
  page,
}) => {
  await page.goto('/ui-kit');
  await expect(
    page.getByRole('heading', { name: 'UI-kit MyStore', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Действие без отправки' }).click();
  await expect(page.getByText('Отправок формы: 0')).toBeVisible();
  await page.getByRole('button', { name: 'Отправить пример' }).click();
  await expect(page.getByText('Отправок формы: 1')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Загрузка примера' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Загрузка примера' }),
  ).toHaveAttribute('aria-busy', 'true');
});
test('field errors and hints are connected to accessible controls', async ({
  page,
}) => {
  await page.goto('/ui-kit');
  const phone = page.getByLabel('Телефон с ошибкой');
  await expect(phone).toHaveAttribute('aria-invalid', 'true');
  await expect(phone).toHaveAccessibleDescription(
    'Например, +996 700 123 456 Введите номер телефона',
  );
  await expect(page.getByLabel('Категория примера')).toBeVisible();
  await expect(page.getByLabel('Согласен с условиями примера')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
});

test('keyboard users can skip navigation and focus controls', async ({
  page,
}) => {
  await page.goto('/ui-kit');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'К содержимому' })).toBeFocused();
  const button = page.getByRole('button', { name: 'Действие без отправки' });
  await button.focus();
  await expect(button).toBeFocused();
  expect(await button.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe(
    'solid',
  );
});
