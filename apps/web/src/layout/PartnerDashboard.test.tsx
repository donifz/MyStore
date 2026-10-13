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
it('switches among granted shops while requesting financial summaries only for owned shops', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    return new Response(
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
          : url.includes('/reports/summary')
            ? {
                revenueMinor: 0,
                physicalUnits: 0,
                openOrders: 0,
                closedShifts: 0,
              }
            : url.endsWith('/current')
              ? null
              : { items: [], total: 0, page: 1, pageSize: 25 },
      ),
      { headers: { 'content-type': 'application/json' } },
    );
  });
  render(
    <MemoryRouter initialEntries={['/seller?view=shops']}>
      <App />
    </MemoryRouter>,
  );
  const select = await screen.findByRole('combobox', {
    name: 'Рабочий контекст',
  });
  await screen.findByRole('heading', { name: 'Мои магазины' });
  expect(calls.some((url) => url.includes('/shop-c/reports/summary'))).toBe(
    false,
  );
  expect(screen.queryByRole('option', { name: 'Платформа' })).toBeNull();
  await userEvent.setup().selectOptions(select, 'shop:shop-b');
  await screen.findByRole('heading', { name: 'Товары' });
  expect(
    screen
      .getByRole('link', { name: 'Товары', current: 'page' })
      .getAttribute('href'),
  ).toBe('/seller/shop-b/products');
  await userEvent
    .setup()
    .selectOptions(
      screen.getByRole('combobox', { name: 'Рабочий контекст' }),
      'shop:shop-c',
    );
  await screen.findByRole('heading', { name: 'Касса' });
  expect(screen.queryByRole('link', { name: 'Отчёты' })).toBeNull();
});
it('opens platform directly for an administrator with no shop memberships', async () => {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/me')
            ? {
                userId: 'admin',
                email: 'admin@test.tld',
                csrfToken: 'csrf',
                platformAdmin: true,
                shops: [],
              }
            : url.endsWith('/overview')
              ? {
                  shopCount: 0,
                  openShifts: 0,
                  pendingPartners: 0,
                  pendingProducts: 0,
                  todaySalesMinor: 0,
                  sales: [],
                  categories: [],
                  shops: [],
                }
              : { items: [], total: 0 },
        ),
        { headers: { 'content-type': 'application/json' } },
      ),
  );
  render(
    <MemoryRouter initialEntries={['/seller']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Администрирование MyStore' });
  expect(
    screen
      .getByRole('combobox', { name: 'Рабочий контекст' })
      .querySelectorAll('option'),
  ).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy();
});
