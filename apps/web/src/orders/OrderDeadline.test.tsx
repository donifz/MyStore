import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App';
import OrderDeadline from './OrderDeadline';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows the deadline on the shop local date with an explicit timezone', () => {
  render(
    <OrderDeadline expiresAt="2026-10-17T20:00:00Z" timeZone="Asia/Bishkek" />,
  );
  expect(screen.getByText(/18\.10\.2026/)).toBeTruthy();
  expect(screen.getByText(/02:00/)).toBeTruthy();
  expect(screen.getByText(/Asia\/Bishkek/)).toBeTruthy();
});
it('does not imply a confirmation deadline after the reserve was cleared', () => {
  const { container } = render(
    <OrderDeadline expiresAt={null} timeZone="Asia/Bishkek" />,
  );
  expect(container.textContent).toBe('');
});
it('filters orders by status and search query', async () => {
  const shop = '11111111-1111-4111-8111-111111111111';
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
          items: [
            {
              id: '12345678-1111-4111-8111-111111111111',
              status: 'ready',
              name: 'Азамат',
              phone: '996700112233',
              fulfillment: 'pickup',
              address: '',
              comment: '',
              totalMinor: 25000,
              createdAt: '2026-10-29T10:00:00Z',
              expiresAt: null,
              timeZone: 'Asia/Bishkek',
              saleId: null,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 25,
        };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={[`/seller/${shop}/orders`]}>
      <App />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await screen.findByText('Азамат');
  await u.selectOptions(screen.getByLabelText('Статус заказа'), 'ready');
  await u.type(screen.getByLabelText('Поиск заказов'), '70011');
  await vi.waitFor(() =>
    expect(
      urls.some((x) => x.includes('status=ready') && x.includes('q=70011')),
    ).toBe(true),
  );
});
