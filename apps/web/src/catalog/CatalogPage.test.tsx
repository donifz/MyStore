import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
const shop = '11111111-1111-4111-8111-111111111111';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function server(role = 'cashier') {
  let calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    let body: any = url.endsWith('/me')
      ? {
          userId: 'user',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role }],
        }
      : url.includes('/variants')
        ? {
            items: [
              {
                id: 'variant',
                name: 'Рюкзак',
                barcode: '00123',
                salePriceMinor: 15000,
                physical: 10,
                reserved: 0,
                available: 10,
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
  return calls;
}
it('cashier sees stock but cannot create or read procurement cost', async () => {
  server();
  const app = await import('../App').catch(() => null);
  expect(app).not.toBeNull();
  if (!app) return;
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByText('Рюкзак');
  expect(screen.queryByRole('link', { name: 'Добавить товар' })).toBeNull();
  expect(screen.queryByText('Закупочная стоимость')).toBeNull();
});
it('foreign shop URL never loads foreign catalog', async () => {
  const calls = server();
  const app = await import('../App').catch(() => null);
  expect(app).not.toBeNull();
  if (!app) return;
  render(
    <MemoryRouter initialEntries={['/seller/foreign/products']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByText('Нет доступа к магазину');
  expect(calls.some((x) => x.includes('/shops/foreign/'))).toBe(false);
});
it('creation does not silently receive stock', async () => {
  const calls = server('owner');
  const app = await import('../App').catch(() => null);
  expect(app).not.toBeNull();
  if (!app) return;
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products/new']}>
      <app.default />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText('Название'), 'Сумка');
  await u.type(screen.getByLabelText('Цена продажи, сом'), '150,25');
  await u.click(screen.getByRole('button', { name: 'Сохранить товар' }));
  await screen.findByText('Товар создан. Остаток не изменён.');
  expect(calls.some((x) => x.includes('/receivings'))).toBe(false);
});
