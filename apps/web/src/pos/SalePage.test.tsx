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
it('three scanner entries make quantity three without saving cost in cashier draft', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'cashier',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role: 'cashier' }],
        }
      : url.endsWith('/current')
        ? {
            id: 'shift',
            actorId: 'cashier',
            status: 'open',
            expectedCashMinor: 0,
          }
        : url.includes('/by-barcode')
          ? {
              id: 'v',
              name: 'Рюкзак',
              barcode: '00123',
              salePriceMinor: 15000,
              stockValueMinor: 9999,
            }
          : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/pos']}>
      <App />
    </MemoryRouter>,
  );
  const scanner = await screen.findByLabelText('Сканировать штрихкод'),
    u = userEvent.setup();
  await u.type(scanner, '00123{Enter}00123{Enter}00123{Enter}');
  await vi.waitFor(() =>
    expect(
      (screen.getByLabelText('Количество Рюкзак') as HTMLInputElement).value,
    ).toBe('3'),
  );
  const raw = localStorage.getItem('mystore:draft:cashier:' + shop + ':sale')!;
  expect(raw).toContain('00123');
  expect(raw).not.toContain('stockValueMinor');
  expect(raw).not.toContain('unitCost');
});

it('allows entering discount and reason on sale line and updates total', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'cashier',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role: 'cashier' }],
        }
      : url.endsWith('/current')
        ? {
            id: 'shift',
            actorId: 'cashier',
            status: 'open',
            expectedCashMinor: 0,
          }
        : url.includes('/by-barcode')
          ? {
              id: 'v1',
              name: 'Куртка',
              barcode: '99001',
              salePriceMinor: 100000, // 1000 Som
            }
          : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/pos']}>
      <App />
    </MemoryRouter>,
  );
  const scanner = await screen.findByLabelText('Сканировать штрихкод'),
    u = userEvent.setup();
  await u.type(scanner, '99001{Enter}');
  await screen.findByText('Куртка');

  // Find discount input
  const discountInput = screen.getByPlaceholderText('0');
  await u.type(discountInput, '100'); // 100 Som discount

  // Reason input appears
  const reasonInput = await screen.findByPlaceholderText(
    'Причина (обязательно при скидке)',
  );
  await u.type(reasonInput, 'Сезонная акция');

  // Verify line discounted price and total both show 900 Som (1000 - 100)
  expect(screen.getAllByText('900,00 сом').length).toBe(2);

  const raw = localStorage.getItem('mystore:draft:cashier:' + shop + ':sale')!;
  expect(raw).toContain('"discountMinor":10000');
  expect(raw).toContain('Сезонная акция');
});
