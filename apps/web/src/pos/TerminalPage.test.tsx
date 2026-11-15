import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('loads terminal settings, saves changes, and triggers test print + long polling ack', async () => {
  const printMock = vi.fn();
  vi.stubGlobal('print', printMock);

  let savedSettings = {
    enabled: false,
    paymentQrData: null as string | null,
    paymentQrLabel: 'Оплата по QR',
    showQrOnCheckout: true,
    printQrOnReceipt: false,
    paperWidth: 58,
    autoPrint: true,
    receiptHeader: '',
    receiptFooter: 'Спасибо за покупку!',
  };

  let pollCount = 0;
  let ackCalled = false;

  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET';

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

    if (url.endsWith('/pos/terminal/settings') && method === 'GET') {
      return new Response(JSON.stringify(savedSettings), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/pos/terminal/settings') && method === 'PUT') {
      savedSettings = {
        ...savedSettings,
        ...JSON.parse(String(init?.body || '{}')),
      };
      return new Response(JSON.stringify(savedSettings), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/pos/terminal/jobs')) {
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/fiscal/status')) {
      return new Response(JSON.stringify({ configured: false, mode: 'none' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    if (url.endsWith('/pos/terminal/test-print') && method === 'POST') {
      return new Response(
        JSON.stringify({
          id: 'job-test-1',
          shopId,
          saleId: null,
          kind: 'test',
          status: 'pending',
          payload: {
            shopName: 'Магазин у дома',
            method: 'cash',
            totalMinor: 15000,
            createdAt: '2026-11-15T10:00:00.000Z',
            lines: [
              {
                name: 'Тестовый товар',
                quantity: 1,
                unitPriceMinor: 15000,
                discountMinor: 0,
              },
            ],
          },
          error: null,
          createdAt: '2026-11-15T10:00:00.000Z',
          updatedAt: '2026-11-15T10:00:00.000Z',
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    }

    if (url.endsWith('/pos/terminal/poll')) {
      pollCount += 1;
      if (pollCount === 1) {
        return new Response(
          JSON.stringify({
            jobs: [
              {
                id: 'job-sale-1',
                shopId,
                saleId: 'sale-1',
                kind: 'receipt',
                status: 'pending',
                payload: {
                  shopName: 'Магазин у дома',
                  method: 'card',
                  totalMinor: 25000,
                  createdAt: '2026-11-15T10:01:00.000Z',
                  lines: [
                    {
                      name: 'Кофе',
                      quantity: 1,
                      unitPriceMinor: 25000,
                      discountMinor: 0,
                    },
                  ],
                },
                error: null,
                createdAt: '2026-11-15T10:01:00.000Z',
                updatedAt: '2026-11-15T10:01:00.000Z',
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Promise((_, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError')),
        );
      });
    }

    if (url.includes('/pos/terminal/jobs/') && url.endsWith('/ack')) {
      ackCalled = true;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={[`/seller/${shopId}/terminal`]}>
      <App />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole('heading', { name: 'Терминал и ККМ' }),
  ).toBeTruthy();

  const enableCheckbox = screen.getByLabelText(
    'Включить терминал печати чеков и QR-оплату',
  ) as HTMLInputElement;
  expect(enableCheckbox.checked).toBe(false);
  expect(
    (
      screen.getByRole('button', {
        name: 'Запустить приём чеков',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);

  await user.click(enableCheckbox);
  const headerInput = screen.getByLabelText('Шапка чека');
  await user.type(headerInput, 'ул. Киевская 10');
  await user.click(screen.getByRole('button', { name: 'Сохранить настройки' }));

  expect(await screen.findByText('Настройки терминала сохранены')).toBeTruthy();
  expect(savedSettings.enabled).toBe(true);
  expect(savedSettings.receiptHeader).toBe('ул. Киевская 10');

  await user.click(screen.getByRole('button', { name: 'Тестовая печать' }));
  await waitFor(() => expect(printMock).toHaveBeenCalled());

  await user.click(
    screen.getByRole('button', { name: 'Запустить приём чеков' }),
  );
  await waitFor(() => expect(ackCalled).toBe(true));
  expect(await screen.findByText('1. Кофе')).toBeTruthy();
});
