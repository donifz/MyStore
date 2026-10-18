import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { Draft, save } from '../drafts/draft-store';
const shop = '11111111-1111-4111-8111-111111111111';
const root = '/seller/' + shop;
const sale = {
  id: 'sale-A',
  totalMinor: 30000,
  createdAt: '2026-10-07T00:00:00Z',
  method: 'card',
  shiftId: 'shift',
  lines: [
    {
      id: 'line-A',
      variantId: 'v',
      name: 'Рюкзак A',
      barcode: '001',
      quantity: 2,
      returnedQuantity: 1,
      unitPriceMinor: 15000,
    },
  ],
};
function pending(
  kind: Draft['scope']['kind'],
  body: unknown,
  lines: Draft['lines'] = [],
) {
  save({
    version: 1,
    scope: { userId: 'employee', shopId: shop, kind },
    revision: 'revision',
    lines,
    submission: {
      key: 'original-key',
      path:
        '/shops/' +
        shop +
        '/pos/' +
        (kind === 'shift-open'
          ? 'shifts'
          : kind === 'return'
            ? 'returns'
            : 'sales'),
      body,
      status: 'unknown',
    },
  });
}
function start(path: string, role = 'owner') {
  const requests: string[] = [];
  const posts: { key: string | null; body: any }[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    requests.push(url);
    let body: unknown = {};
    if (options?.method === 'POST') {
      posts.push({
        key: new Headers(options.headers).get('Idempotency-Key'),
        body: JSON.parse(options.body as string),
      });
      body = { id: 'shift' };
    } else if (url.endsWith('/me'))
      body = {
        userId: 'employee',
        email: 'employee@test.tld',
        csrfToken: 'csrf',
        shops: [{ id: shop, name: 'Магазин', role }],
      };
    else if (url.endsWith('/active') || url.endsWith('/current'))
      body = {
        id: 'shift',
        actorId: 'employee',
        status: 'open',
        openedAt: '2026-10-07T00:00:00Z',
        openingCashMinor: 10000,
        expectedCashMinor: 10000,
        salesCashMinor: 0,
        salesCardMinor: 0,
        refundsCashMinor: 0,
        refundsCardMinor: 0,
      };
    else if (url.includes('/pos/sales?'))
      body = { items: [sale], total: 1, page: 1, pageSize: 25 };
    else if (url.endsWith('/sales/sale-A')) body = sale;
    else if (url.endsWith('/sales/sale-B'))
      body = {
        ...sale,
        id: 'sale-B',
        lines: [{ ...sale.lines[0], id: 'line-B', name: 'Рюкзак B' }],
      };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={[root + path]}>
      <App />
    </MemoryRouter>,
  );
  return { requests, posts };
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it('restores the card method of a frozen sale after reload', async () => {
  pending(
    'sale',
    {
      shiftId: 'shift',
      method: 'card',
      lines: [{ variantId: 'v', quantity: 2, expectedUnitPriceMinor: 15000 }],
    },
    [
      {
        id: 'v',
        name: 'Рюкзак A',
        barcode: '001',
        quantity: 2,
        priceMinor: 15000,
      },
    ],
  );
  start('/pos');
  const field = (await screen.findByRole('radio', {
    name: 'Банковская карта',
  })) as HTMLInputElement;
  expect(field.checked).toBe(true);
  expect((field.closest('fieldset') as HTMLFieldSetElement).disabled).toBe(
    true,
  );
});
it('shows the source sale and exact financial controls of a recovered return even on another sale URL', async () => {
  pending('return', {
    saleId: 'sale-A',
    shiftId: 'shift',
    refundMoney: true,
    method: 'card',
    reason: 'Не подошёл',
    lines: [{ saleLineId: 'line-A', quantity: 1, condition: 'defective' }],
  });
  const { requests } = start('/sales/sale-B/return');
  const quantity = (await screen.findByLabelText(
    'Вернуть Рюкзак A',
  )) as HTMLInputElement;
  expect(quantity.value).toBe('1');
  expect(quantity.disabled).toBe(true);
  expect(
    (screen.getByLabelText('Состояние Рюкзак A') as HTMLSelectElement).value,
  ).toBe('defective');
  expect(
    (screen.getByLabelText('Причина возврата') as HTMLTextAreaElement).value,
  ).toBe('Не подошёл');
  expect(
    (screen.getByLabelText('Способ возврата денег') as HTMLSelectElement).value,
  ).toBe('card');
  expect(screen.getByText('150,00 сом', { selector: 'p.total' })).toBeTruthy();
  expect(requests.some((url) => url.endsWith('/sales/sale-B'))).toBe(false);
});
it('reconciles an opening with a lost response while the committed shift is already open', async () => {
  pending('shift-open', { openingCashMinor: 10000 });
  const { posts } = start('/shift');
  await screen.findByText('Смена открыта', { exact: true });
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Повторить открытие' }));
  await vi.waitFor(() =>
    expect(posts).toEqual([
      { key: 'original-key', body: { openingCashMinor: 10000 } },
    ]),
  );
  await vi.waitFor(() =>
    expect(
      screen.queryByRole('button', { name: 'Повторить открытие' }),
    ).toBeNull(),
  );
});
it('lets a cashier open their sale detail and see returned quantities without return controls', async () => {
  start('/sales', 'cashier');
  const u = userEvent.setup();
  await u.click(await screen.findByRole('link', { name: 'Открыть продажу' }));
  await screen.findByText('Рюкзак A');
  expect(screen.getByText(/Продано 2, возвращено 1/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Оформить возврат' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Провести возврат' })).toBeNull();
});
it('persists the receiving cost typed before an asynchronous draft lock is granted', async () => {
  save({
    version: 1,
    scope: { userId: 'employee', shopId: shop, kind: 'receiving' },
    revision: 'receiving-revision',
    submission: null,
    lines: [
      {
        id: 'v',
        name: 'Рюкзак A',
        barcode: '001',
        quantity: 2,
        priceMinor: 15000,
        unitCostText: '',
      },
    ],
  });
  start('/receiving');
  const cost = await screen.findByLabelText('Закупочная цена Рюкзак A, сом');
  await userEvent.setup().type(cost, '100');
  await vi.waitFor(() => expect((cost as HTMLInputElement).value).toBe('100'));
  expect(
    JSON.parse(
      localStorage.getItem('mystore:draft:employee:' + shop + ':receiving')!,
    ).lines[0].unitCostText,
  ).toBe('100');
});
