import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';

const shop = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('applies date presets and forwards period filter to sales and orders CSV links', async () => {
  const urls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    urls.push(url);
    const body = url.endsWith('/me')
      ? {
          userId: 'owner-1',
          email: 'owner@example.test',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role: 'owner' }],
        }
      : {
          revenueMinor: 50000,
          salesMinor: 50000,
          returnsMinor: 0,
          returnsCount: 0,
          posSalesMinor: 50000,
          posSalesCount: 2,
          onlineSalesMinor: 0,
          onlineSalesCount: 0,
          costOfGoodsMinor: 30000,
          grossProfitMinor: 20000,
          paymentsReceivedMinor: 50000,
          paymentsRefundedMinor: 0,
          cashReceivedMinor: 50000,
          cardReceivedMinor: 0,
          physicalUnits: 10,
          reservedUnits: 0,
          stockValueMinor: 100000,
          lowStockCount: 0,
          openOrders: 0,
          issuedOrders: 0,
          issuedOrdersMinor: 0,
          closedShifts: 1,
          cashDiscrepancyMinor: 0,
          dailySeries: [
            {
              day: '2026-10-29',
              salesMinor: 50000,
              returnsMinor: 0,
              netMinor: 50000,
              salesCount: 2,
            },
          ],
          topProducts: [
            {
              id: 'p1',
              name: 'Кофе в зёрнах',
              category: 'Продукты',
              quantitySold: 2,
              revenueMinor: 50000,
              profitMinor: 20000,
            },
          ],
          categoryShare: [
            {
              category: 'Продукты',
              revenueMinor: 50000,
              quantitySold: 2,
            },
          ],
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={[`/seller/${shop}/reports`]}>
      <App />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await screen.findByText('Выручка за вычетом возвратов');
  expect(screen.getByText('Продажи и возвраты по дням')).toBeTruthy();
  expect(screen.getByText('Каналы продаж и оплата')).toBeTruthy();
  expect(screen.getByText('Структура выручки и маржинальность')).toBeTruthy();
  expect(screen.getByText('40%')).toBeTruthy();
  expect(screen.getByText(/Кофе в зёрнах \(2 шт\.\)/)).toBeTruthy();
  await u.click(screen.getByRole('button', { name: '7 дней' }));
  await vi.waitFor(() =>
    expect(urls.some((x) => x.includes('/reports/summary?from='))).toBe(true),
  );
  const salesExport = screen
    .getByRole('link', { name: 'Продажи' })
    .getAttribute('href');
  const stockExport = screen
    .getByRole('link', { name: 'Остатки' })
    .getAttribute('href');
  expect(salesExport).toContain('/reports/export/sales.csv?from=');
  expect(stockExport).toBe(`/api/shops/${shop}/reports/export/stock.csv`);
});
