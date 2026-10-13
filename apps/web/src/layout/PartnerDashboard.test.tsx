import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('routes sidebar actions to the selected owned shop without exposing another shop', async () => {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/me')
            ? {
                userId: 'owner',
                email: 'owner@test.tld',
                csrfToken: 'csrf',
                shops: [
                  { id: 'shop-a', name: 'Первый магазин', role: 'owner' },
                  { id: 'shop-b', name: 'Второй магазин', role: 'owner' },
                  { id: 'shop-c', name: 'Рабочий магазин', role: 'cashier' },
                ],
              }
            : {
                revenueMinor: 0,
                physicalUnits: 0,
                openOrders: 0,
                closedShifts: 0,
              },
        ),
        { headers: { 'content-type': 'application/json' } },
      ),
  );
  render(
    <MemoryRouter initialEntries={['/seller']}>
      <App />
    </MemoryRouter>,
  );
  const select = await screen.findByRole('combobox', {
    name: 'Магазин для переходов',
  });
  expect(
    screen.getByRole('link', { name: 'Товары и остатки' }).getAttribute('href'),
  ).toBe('/seller/shop-a/products');
  await userEvent.setup().selectOptions(select, 'shop-b');
  expect(
    screen.getByRole('link', { name: 'Товары и остатки' }).getAttribute('href'),
  ).toBe('/seller/shop-b/products');
  expect(
    screen.getByRole('link', { name: 'Продажи и смены' }).getAttribute('href'),
  ).toBe('/seller/shop-b/sales');
  expect(screen.queryByRole('option', { name: 'Рабочий магазин' })).toBeNull();
  expect(
    screen.queryByRole('link', { name: /^Администрирование$/ }),
  ).toBeNull();
});

it('gives an administrator with no shops a styled entry to platform administration', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          userId: 'admin',
          email: 'admin@test.tld',
          csrfToken: 'csrf',
          platformAdmin: true,
          shops: [],
        }),
      ),
  );
  render(
    <MemoryRouter initialEntries={['/seller']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Выберите магазин' });
  expect(
    screen
      .getByRole('link', { name: 'Кабинет платформы' })
      .getAttribute('href'),
  ).toBe('/platform/admin');
  expect(screen.getByText('Доступ к магазину пока не выдан.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy();
});
