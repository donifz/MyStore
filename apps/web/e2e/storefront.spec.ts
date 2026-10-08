import { test, expect } from '@playwright/test';

test('buyer submits a partner application without creating a login', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Найдите своё в магазинах рядом' }),
  ).toBeVisible();
  await page
    .getByRole('link', { name: 'Стать партнёром', exact: true })
    .click();
  await page.getByLabel('Название магазина').fill('Магазин у дома');
  await page.getByLabel('Email').fill('partner-browser@example.test');
  await page.getByLabel('Телефон').fill('+996700123456');
  await page.getByLabel('Город').fill('Ош');
  await page.getByLabel('Адрес').fill('Центр');
  await page.getByLabel('Категория бизнеса').fill('Подарки');
  await page.getByLabel('Согласен с условиями подключения').check();
  await page.getByRole('button', { name: 'Отправить заявку' }).click();
  await expect(page.getByRole('status')).toContainText('Заявка отправлена.');
  await expect(page.getByRole('link', { name: 'Войти в кабинет' })).toHaveCount(
    0,
  );
  const login = await request.post('/api/auth/login', {
    data: {
      email: 'partner-browser@example.test',
      password: 'partner-browser-password',
    },
  });
  expect(login.ok()).toBe(false);
  await page.goto('/partner/activate?token=' + 'a'.repeat(64));
  await page.getByLabel('Новый пароль').fill('partner-browser-password');
  await page.getByRole('button', { name: 'Активировать кабинет' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('Кабинет активирован.')).toHaveCount(0);
});
