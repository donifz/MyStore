import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  render,
  screen,
  within,
  fireEvent,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { save, load } from '../drafts/draft-store';
const shop = '11111111-1111-4111-8111-111111111111';
const scope = { userId: 'employee', shopId: shop, kind: 'receiving' as const };
const existing = {
  id: 'existing',
  name: 'Рюкзак',
  barcode: '00123',
  quantity: 3,
  priceMinor: 15000,
  unitCostText: '100',
};
const code = '0009876543210';
function start(role = 'owner', creationStatus = 201) {
  save({
    version: 1,
    scope,
    revision: 'original',
    submission: null,
    lines: [existing],
  });
  const calls: { url: string; method: string; body?: any }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      ...(init?.body ? { body: JSON.parse(init.body as string) } : {}),
    });
    let status = 200,
      body: unknown = {};
    if (url.endsWith('/me'))
      body = {
        userId: scope.userId,
        email: 'employee@example.test',
        csrfToken: 'csrf',
        shops: [{ id: shop, name: 'Магазин', role }],
      };
    else if (url.includes('by-barcode')) {
      if (creationStatus === 409 && calls.some((c) => c.method === 'POST'))
        body = {
          id: 'new',
          name: 'Существующий принтер',
          barcode: code,
          salePriceMinor: 210000,
        };
      else {
        status = 404;
        body = { message: 'missing' };
      }
    } else if (url.endsWith('/variants') && method === 'POST') {
      status = creationStatus;
      body =
        status === 201
          ? {
              id: 'new',
              name: 'Принтер',
              barcode: code,
              salePriceMinor: 200000,
            }
          : { message: 'failed' };
    } else if (url.endsWith('/receivings')) body = { id: 'receipt' };
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/receiving']}>
      <App />
    </MemoryRouter>,
  );
  return calls;
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
async function openCreation() {
  const u = userEvent.setup();
  await u.type(
    await screen.findByLabelText('Сканировать штрихкод'),
    code + '{Enter}',
  );
  await u.click(
    await screen.findByRole('button', {
      name: 'Создать товар с этим штрихкодом',
    }),
  );
  return {
    u,
    form: within(screen.getByRole('form', { name: 'Новый товар в приёмке' })),
  };
}
it('creates an unknown barcode inline, preserves prior lines, and receives only after confirmation', async () => {
  const calls = start();
  const { u, form } = await openCreation();
  expect((form.getByLabelText('Штрихкод') as HTMLInputElement).value).toBe(
    code,
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Провести приёмку',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.click(
    form.getByRole('button', { name: 'Создать и добавить в приёмку' }),
  );
  await screen.findByLabelText('Количество Принтер');
  expect(
    screen.queryByRole('form', { name: 'Новый товар в приёмке' }),
  ).toBeNull();
  expect(load(scope)?.lines).toEqual([
    existing,
    {
      id: 'new',
      name: 'Принтер',
      barcode: code,
      quantity: 1,
      priceMinor: 200000,
      unitCostText: '',
    },
  ]);
  expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
    '/api/shops/' + shop + '/variants',
  ]);
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
    name: 'Принтер',
    barcode: code,
    salePriceMinor: 200000,
  });
  fireEvent.change(screen.getByLabelText('Количество Принтер'), {
    target: { value: '5' },
  });
  await u.type(screen.getByLabelText('Закупочная цена Принтер, сом'), '1500');
  await u.click(screen.getByRole('button', { name: 'Провести приёмку' }));
  await screen.findByText('Документ проведён: receipt');
  expect(
    calls.find((c) => c.method === 'POST' && c.url.endsWith('/receivings'))
      ?.body,
  ).toMatchObject({
    lines: [
      { variantId: 'existing', quantity: 3, unitCostMinor: 10000 },
      { variantId: 'new', quantity: 5, unitCostMinor: 150000 },
    ],
  });
});
it('cancelling inline creation leaves the current receipt unchanged', async () => {
  const calls = start('manager');
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Не сохранять');
  await u.click(form.getByRole('button', { name: 'Отмена' }));
  expect(load(scope)?.lines).toEqual([existing]);
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
  expect(
    (screen.getByLabelText('Сканировать штрихкод') as HTMLInputElement)
      .disabled,
  ).toBe(false);
});
it('failed creation keeps entered fields and does not change the receipt', async () => {
  const calls = start('owner', 500);
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.click(
    form.getByRole('button', { name: 'Создать и добавить в приёмку' }),
  );
  await form.findByRole('alert');
  expect((form.getByLabelText('Название') as HTMLInputElement).value).toBe(
    'Принтер',
  );
  expect(load(scope)?.lines).toEqual([existing]);
  expect(
    calls.some((c) => c.method === 'POST' && c.url.endsWith('/receivings')),
  ).toBe(false);
});
it('cashier cannot load or create a receiving product', async () => {
  const calls = start('cashier');
  await screen.findByRole('alert');
  expect(screen.queryByLabelText('Сканировать штрихкод')).toBeNull();
  expect(calls.some((c) => c.url.includes('/variants'))).toBe(false);
});

it('a barcode created concurrently is confirmed explicitly without creating a second card', async () => {
  const calls = start('owner', 409);
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.click(
    form.getByRole('button', { name: 'Создать и добавить в приёмку' }),
  );
  await form.findByText(/Существующий принтер/);
  expect(load(scope)?.lines).toEqual([existing]);
  await u.click(form.getByRole('button', { name: 'Добавить в приёмку' }));
  await screen.findByLabelText('Количество Существующий принтер');
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/variants')),
  ).toHaveLength(1);
  expect(load(scope)?.lines[1].priceMinor).toBe(210000);
});
it('a receiving document with an uncertain result cannot scan or create another product', async () => {
  start();
  cleanup();
  const current = load(scope)!;
  save({
    ...current,
    submission: {
      key: current.revision,
      path: '/shops/' + shop + '/receivings',
      body: { lines: [] },
      status: 'unknown',
    },
  });
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/receiving']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('button', { name: 'Повторить исходный запрос' });
  expect(
    (screen.getByLabelText('Сканировать штрихкод') as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(
    screen.queryByRole('button', { name: 'Создать товар с этим штрихкодом' }),
  ).toBeNull();
});
