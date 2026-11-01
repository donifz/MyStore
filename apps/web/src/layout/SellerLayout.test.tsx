import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shop = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders store dashboard with KPIs, low stock, recent sales and period selector for owner', async () => {
  const requestedUrls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requestedUrls.push(url);
    const body = url.endsWith('/me')
      ? {
          userId: 'owner',
          email: 'owner@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Юный инженер', role: 'owner' }],
        }
      : url.includes('/reports/summary')
        ? {
            revenueMinor: 1248000,
            salesMinor: 1248000,
            returnsMinor: 0,
            posSalesCount: 25,
            onlineSalesCount: 2,
            costOfGoodsMinor: 800000,
            grossProfitMinor: 448000,
            paymentsReceivedMinor: 1248000,
            paymentsRefundedMinor: 0,
            cashReceivedMinor: 700000,
            cardReceivedMinor: 548000,
            physicalUnits: 120,
            reservedUnits: 0,
            stockValueMinor: 500000,
            lowStockCount: 2,
            openOrders: 1,
            issuedOrders: 2,
            closedShifts: 4,
            cashDiscrepancyMinor: 0,
            dailySeries: [
              {
                day: '2026-10-30',
                salesMinor: 500000,
                returnsMinor: 0,
                netMinor: 500000,
                salesCount: 10,
              },
              {
                day: '2026-10-31',
                salesMinor: 748000,
                returnsMinor: 0,
                netMinor: 748000,
                salesCount: 17,
              },
            ],
          }
        : url.includes('/variants')
          ? {
              items: [
                {
                  id: 'v1',
                  name: 'Автотрек с машинками',
                  barcode: '100321',
                  salePriceMinor: 97100,
                  available: 2,
                },
                {
                  id: 'v2',
                  name: 'Набор Arduino',
                  barcode: '100325',
                  salePriceMinor: 78000,
                  available: 15,
                },
              ],
              total: 2,
              page: 1,
              pageSize: 48,
            }
          : url.includes('/pos/sales')
            ? {
                items: [
                  {
                    id: '000427-sale',
                    totalMinor: 97100,
                    createdAt: '2026-10-31T08:28:00.000Z',
                    shiftId: 'shift-1',
                    method: 'card',
                  },
                ],
                total: 1,
                page: 1,
                pageSize: 20,
              }
            : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={['/seller/' + shop]}>
      <App />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Главная' });
  await screen.findByText('Автотрек с машинками');
  await screen.findByText(/Чек #000427/);
  expect(screen.getAllByText('12 480,00 сом').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('link', { name: /Открыть кассу/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Новая приёмка/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Создать товар/ })).toBeTruthy();

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Сегодня' }));
  expect(requestedUrls.some((u) => u.includes('/reports/summary'))).toBe(true);
});

it('does not request reports or show catalog creation actions for cashier on store dashboard', async () => {
  const requestedUrls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requestedUrls.push(url);
    const body = url.endsWith('/me')
      ? {
          userId: 'cashier',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Юный инженер', role: 'cashier' }],
        }
      : url.includes('/variants')
        ? { items: [], total: 0, page: 1, pageSize: 48 }
        : url.includes('/pos/sales')
          ? { items: [], total: 0, page: 1, pageSize: 20 }
          : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={['/seller/' + shop]}>
      <App />
    </MemoryRouter>,
  );

  await screen.findByRole('heading', { name: 'Главная' });
  expect(requestedUrls.some((u) => u.includes('/reports/'))).toBe(false);
  expect(screen.queryByRole('link', { name: /Новая приёмка/ })).toBeNull();
  expect(screen.queryByRole('link', { name: /Создать товар/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Открыть кассу/ })).toBeTruthy();
});
