import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '../App';
import type { Me } from '../api/types';
const shop = { id: 'own', name: 'Мой магазин', role: 'owner' as const };
const base: Me = {
  userId: 'u',
  email: 'admin@test.tld',
  csrfToken: 'c',
  shops: [shop],
};
function Probe() {
  const l = useLocation();
  return <output aria-label="Адрес">{l.pathname + l.search}</output>;
}
function open(user: Me, path = '/seller', state?: unknown) {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/me')
            ? user
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
              : url.endsWith('/current')
                ? null
                : {
                    items: [],
                    total: 0,
                    page: 1,
                    pageSize: 25,
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
    <MemoryRouter
      initialEntries={[
        {
          pathname: path.split('?')[0],
          search: path.includes('?') ? '?' + path.split('?')[1] : '',
          state,
        },
      ]}
    >
      <App />
      <Probe />
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('sends an admin with one shop to platform and an owner directly to products', async () => {
  open({ ...base, platformAdmin: true });
  await screen.findByRole('heading', { name: 'Администрирование MyStore' });
  expect(screen.getByLabelText('Адрес').textContent).toBe('/platform/admin');
  cleanup();
  open(base);
  await screen.findByRole('heading', { name: 'Товары' });
  expect(screen.getByLabelText('Адрес').textContent).toBe(
    '/seller/own/products',
  );
  expect(screen.queryByText('Панель партнёра MyStore')).toBeNull();
});
it('lands a cashier in the cash register, and a manager in products', async () => {
  open({ ...base, shops: [{ ...shop, role: 'cashier' }] });
  await screen.findByRole('heading', { name: 'Касса' });
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller/own/pos');
  cleanup();
  open({ ...base, shops: [{ ...shop, role: 'manager' }] });
  await screen.findByRole('heading', { name: 'Товары' });
  expect(screen.getByLabelText('Адрес').textContent).toBe(
    '/seller/own/products',
  );
});
it('retains a platform section from a direct URL and one active navigation item', async () => {
  open({ ...base, platformAdmin: true }, '/platform/admin?section=audit');
  await screen.findByRole('link', { name: 'Аудит', current: 'page' });
  expect(document.querySelectorAll('nav [aria-current="page"]')).toHaveLength(
    1,
  );
  expect(screen.getByLabelText('Адрес').textContent).toBe(
    '/platform/admin?section=audit',
  );
});
it('keeps explicit shop selection for an admin with several shops', async () => {
  open(
    {
      ...base,
      platformAdmin: true,
      shops: [shop, { ...shop, id: 'second', name: 'Второй' }],
    },
    '/seller?view=shops',
  );
  await screen.findByRole('heading', { name: 'Мои магазины' });
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller?view=shops');
});
it('provides an empty common workspace for an account without rights', async () => {
  open({ ...base, shops: [] });
  await screen.findByText('Доступ к магазину пока не выдан.');
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller?view=shops');
});
it('honors a permitted login return and rejects a forbidden role or foreign URL', async () => {
  open(base, '/seller/login', { from: '/seller/own/shift' });
  await screen.findByRole('heading', { name: 'Смена' });
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller/own/shift');
  cleanup();
  open({ ...base, shops: [{ ...shop, role: 'cashier' }] }, '/seller/login', {
    from: '/seller/own/reports',
  });
  await screen.findByRole('heading', { name: 'Касса' });
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller/own/pos');
  cleanup();
  open(base, '/seller/login', { from: 'https://evil.test' });
  await screen.findByRole('heading', { name: 'Товары' });
  expect(screen.getByLabelText('Адрес').textContent).toBe(
    '/seller/own/products',
  );
});
