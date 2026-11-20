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

it('filters sales history by search, status, date range, and initializes from URL query params', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    const body = url.endsWith('/me')
      ? {
          userId: 'owner',
          email: 'owner@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role: 'owner' }],
        }
      : url.includes('/pos/sales')
        ? {
            items: [
              {
                id: '3b220f11-1111-4111-8111-111111111111',
                totalMinor: 70000,
                createdAt: '2026-11-19T10:31:00.000Z',
                shiftId: 'shift-1',
                method: 'card',
                hasReturns: true,
                isCredit: false,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 25,
          }
        : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/sales?from=2026-11-19&to=2026-11-19`]}
    >
      <App />
    </MemoryRouter>,
  );

  await screen.findByText(/Чек #3B220F11/);
  expect(screen.getByText('Возврат')).toBeTruthy();
  expect(
    calls.some(
      (u) =>
        u.includes('/pos/sales') &&
        u.includes('from=2026-11-19') &&
        u.includes('to=2026-11-19'),
    ),
  ).toBe(true);

  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Поиск чека'), '3b220f');
  await user.selectOptions(screen.getByLabelText('Статус'), 'returned');

  await vi.waitFor(() =>
    expect(
      calls.some(
        (u) => u.includes('q=3b220f') && u.includes('status=returned'),
      ),
    ).toBe(true),
  );
});
