import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders only the terminal kiosk without settings link or extra tabs', async () => {
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

    return new Response(JSON.stringify({}), { status: 404 });
  });

  render(
    <MemoryRouter initialEntries={[`/terminal/${shopId}`]}>
      <App />
    </MemoryRouter>,
  );

  await screen.findByText('Ожидание продажи');
  expect(screen.queryByRole('link', { name: 'Настройки' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Продажи смены/ })).toBeNull();
  expect(screen.getByText('Только терминал')).toBeTruthy();
  expect(pollRequests).toBeGreaterThanOrEqual(1);
});

it('redirects APK AndroidPrinter from /seller/login straight to /terminal/:shopId', async () => {
  (window as { AndroidPrinter?: unknown }).AndroidPrinter = {
    isAvailable: () => true,
  };

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

    return new Response(JSON.stringify({}), { status: 404 });
  });

  render(
    <MemoryRouter initialEntries={['/seller/login']}>
      <App />
    </MemoryRouter>,
  );

  await screen.findByText('Ожидание продажи');
  expect(screen.getByText('Только терминал')).toBeTruthy();
  delete (window as { AndroidPrinter?: unknown }).AndroidPrinter;
});
