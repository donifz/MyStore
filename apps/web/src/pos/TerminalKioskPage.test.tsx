import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';
const shiftId = '22222222-2222-4222-8222-222222222222';
const saleId = '33333333-3333-4333-8333-333333333333';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('splits kiosk into Terminal and Current Shift Sales tabs without settings link', async () => {
  let requestedShiftFilter = '';
  let pollRequests = 0;

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/me')) {
      return new Response(
        JSON.stringify({
          userId: 'owner-id',
          email: 'owner@example.test',
          csrfToken: 'csrf',
          shops: [{ id: shopId, name: 'Магазин у дома', role: 'owner' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.endsWith('/pos/terminal/settings')) {
      return new Response(
        JSON.stringify({
          enabled: true,
          paymentQrData: null,
          paymentQrLabel: 'Оплата по QR',
          showQrOnCheckout: true,
          printQrOnReceipt: false,
          paperWidth: 58,
          autoPrint: true,
          receiptHeader: '',
          receiptFooter: 'Спасибо за покупку!',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.endsWith('/pos/terminal/poll')) {
      pollRequests += 1;
      return new Promise<Response>((resolve) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          resolve(
            new Response(JSON.stringify({ jobs: [] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
          return;
        }
        signal?.addEventListener('abort', () => {
          resolve(
            new Response(JSON.stringify({ jobs: [] }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          );
        });
      });
    }

    if (url.endsWith('/pos/shifts/active')) {
      return new Response(
        JSON.stringify({
          id: shiftId,
          shopId,
          actorId: 'owner-id',
          status: 'open',
          openingCashMinor: 0,
          openedAt: '2026-11-15T08:00:00.000Z',
          salesCashMinor: 50000,
          salesCardMinor: 0,
          refundsCashMinor: 0,
          refundsCardMinor: 0,
          expectedCashMinor: 50000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.includes('/pos/sales?')) {
      requestedShiftFilter = url;
      return new Response(
        JSON.stringify({
          items: [
            {
              id: saleId,
              totalMinor: 50000,
              createdAt: '2026-11-15T08:30:00.000Z',
              shiftId,
              method: 'cash',
            },
          ],
          total: 1,
          page: 1,
          pageSize: 100,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.endsWith(`/pos/sales/${saleId}`)) {
      return new Response(
        JSON.stringify({
          id: saleId,
          totalMinor: 50000,
          createdAt: '2026-11-15T08:30:00.000Z',
          shiftId,
          method: 'cash',
          lines: [
            {
              id: 'line-1',
              variantId: 'var-1',
              name: 'Хлеб',
              sku: 'SKU-1',
              barcode: null,
              quantity: 2,
              unitPriceMinor: 25000,
              discountMinor: 0,
              lineTotalMinor: 50000,
              returnedQuantity: 0,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    }

    return new Response(JSON.stringify({}), { status: 404 });
  });

  render(
    <MemoryRouter initialEntries={[`/terminal/${shopId}`]}>
      <App />
    </MemoryRouter>,
  );

  await screen.findByText('Ожидание продажи');
  expect(screen.queryByRole('link', { name: 'Настройки' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Терминал' })).toBeTruthy();

  const salesTab = screen.getByRole('button', { name: /Продажи смены/ });
  await userEvent.click(salesTab);

  await screen.findByText('Продажи текущей смены');
  await waitFor(() => {
    expect(requestedShiftFilter).toContain(`shiftId=${shiftId}`);
  });
  const checkBtn = await screen.findByRole('button', { name: /Чек #33333333/ });
  await userEvent.click(checkBtn);

  await screen.findByText(/Хлеб × 2/);
  expect(pollRequests).toBeGreaterThanOrEqual(1);
});
