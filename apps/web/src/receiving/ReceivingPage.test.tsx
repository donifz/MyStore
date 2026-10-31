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
function start(role = 'owner', creationStatus = 201, receivingStatus = 201) {
  save({
    version: 1,
    scope,
    revision: 'original',
    submission: null,
    lines: [existing],
  });
  const calls: {
    url: string;
    method: string;
    key?: string | null;
    body?: any;
  }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      key: new Headers(init?.headers).get('idempotency-key'),
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
    } else if (url.endsWith('/receivings')) {
      status = receivingStatus;
      body = status === 201 ? { id: 'receipt' } : { message: 'failed receipt' };
    }
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
it('creates an unknown barcode, preserves prior lines, and posts its first receiving', async () => {
  const calls = start();
  const { u, form } = await openCreation();
  const workflow = (load(scope) as any)?.primaryReceiving;
  expect(workflow?.barcode).toBe(code);
  expect(workflow?.productKey).toMatch(/^product:/);
  expect(workflow?.receivingKey).toMatch(/^receiving:/);
  expect((form.getByLabelText('Штрихкод') as HTMLInputElement).value).toBe(
    code,
  );
  expect(
    (form.getByLabelText('Количество первичной приёмки') as HTMLInputElement)
      .value,
  ).toBe('1');
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.type(screen.getByLabelText('Номер документа'), 'ТТН-42');
  await u.type(screen.getByLabelText('Поставщик'), 'ОсОО Поставка');
  fireEvent.change(screen.getByLabelText('Дата поставки'), {
    target: { value: '2026-10-25' },
  });
  await u.type(screen.getByLabelText('Комментарий'), 'Первая партия');
  fireEvent.change(form.getByLabelText('Количество первичной приёмки'), {
    target: { value: '5' },
  });
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
  );
  await screen.findByText('Документ проведён: receipt');
  expect(screen.getByRole('status').textContent).toContain('Документ проведён');
  expect(
    screen.queryByRole('button', { name: 'Создать товар с этим штрихкодом' }),
  ).toBeNull();
  expect(screen.getByRole('button', { name: 'Печать этикетки' })).toBeTruthy();
  expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
    '/api/shops/' + shop + '/variants',
    '/api/shops/' + shop + '/receivings',
  ]);
  expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
    name: 'Принтер',
    barcode: code,
    salePriceMinor: 200000,
  });
  expect(calls.find((c) => c.method === 'POST')?.key).toBeTruthy();
  expect(
    calls.find((c) => c.method === 'POST' && c.url.endsWith('/receivings'))
      ?.key,
  ).toBe(workflow?.receivingKey);
  expect(
    calls.find((c) => c.method === 'POST' && c.url.endsWith('/receivings'))
      ?.body,
  ).toMatchObject({
    documentNumber: 'ТТН-42',
    supplier: 'ОсОО Поставка',
    receivedOn: '2026-10-25',
    comment: 'Первая партия',
    lines: [
      { variantId: 'existing', quantity: 3, unitCostMinor: 10000 },
      { variantId: 'new', quantity: 5, unitCostMinor: 150000 },
    ],
  });
});
it('warns on expensive stock and still posts receiving', async () => {
  const calls = start();
  const u = userEvent.setup();
  const input = await screen.findByLabelText('Закупочная цена Рюкзак, сом');
  fireEvent.change(input, { target: { value: '200' } });
  await screen.findByText(/Закупочная цена за штуку выше цены продажи/);
  await u.click(screen.getByRole('button', { name: 'Провести приёмку' }));
  await screen.findByText('Документ проведён: receipt');
  const receipt = calls.find(
    (c) => c.method === 'POST' && c.url.endsWith('/receivings'),
  );
  expect(receipt?.body.lines[0].unitCostMinor).toBe(20000);
});
it('warns on a new product and still posts receiving', async () => {
  const calls = start();
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.type(form.getByLabelText('Закупочная цена, сом'), '2500');
  const warning = form.getByText(/Закупочная цена за штуку выше цены продажи/);
  expect(warning).toBeTruthy();
  const post = form.getByRole('button', { name: 'Создать и провести приёмку' });
  await u.click(post);
  await screen.findByText('Документ проведён: receipt');
  const receipt = calls.find(
    (c) => c.method === 'POST' && c.url.endsWith('/receivings'),
  );
  expect(receipt?.body.lines[1].unitCostMinor).toBe(250000);
});
it('validates existing line costs before creating the card and lets the user fill them in', async () => {
  const calls = start();
  const existingCost = await screen.findByLabelText(
    'Закупочная цена Рюкзак, сом',
  );
  fireEvent.change(existingCost, { target: { value: '' } });
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
  );
  await form.findByText('Укажите корректную закупочную цену для «Рюкзак».');
  expect(
    calls.some((c) => c.method === 'POST' && c.url.endsWith('/variants')),
  ).toBe(false);
  fireEvent.change(existingCost, { target: { value: '120' } });
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
  );
  await screen.findByText('Документ проведён: receipt');
  const receipt = calls.find(
    (c) => c.method === 'POST' && c.url.endsWith('/receivings'),
  );
  expect(receipt?.body.lines).toEqual([
    { variantId: 'existing', quantity: 3, unitCostMinor: 12000 },
    { variantId: 'new', quantity: 1, unitCostMinor: 150000 },
  ]);
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
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
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
it('creates a product without receiving it', async () => {
  const calls = start();
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Товар без остатка');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.click(form.getByRole('button', { name: 'Создать без приёмки' }));
  await screen.findByText('Карточка создана без приёмки. Остаток не изменён.');
  expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
    '/api/shops/' + shop + '/variants',
  ]);
  expect(load(scope)?.lines).toEqual([existing]);
  expect(load(scope)?.primaryReceiving).toBeUndefined();
});
it('creates a product, adds it to the receiving draft, closes the form, and lets scanning continue', async () => {
  const calls = start();
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Принтер');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  fireEvent.change(form.getByLabelText('Количество первичной приёмки'), {
    target: { value: '4' },
  });
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и добавить в приёмку' }),
  );
  await screen.findByText('Товар добавлен в список приёмки.');
  expect(
    screen.queryByRole('form', { name: 'Новый товар в приёмке' }),
  ).toBeNull();
  expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
    '/api/shops/' + shop + '/variants',
  ]);
  expect(load(scope)?.lines).toEqual([
    existing,
    {
      id: 'new',
      name: 'Принтер',
      barcode: code,
      quantity: 4,
      priceMinor: 200000,
      unitCostText: '1500',
    },
  ]);
});
it('keeps the saved card and retries only the failed receiving phase', async () => {
  const calls = start('owner', 201, 500);
  const { u, form } = await openCreation();
  await u.type(form.getByLabelText('Название'), 'Повторный приход');
  await u.type(form.getByLabelText('Цена продажи, сом'), '2000');
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
  );
  await form.findByRole('alert');
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/variants')),
  ).toHaveLength(1);
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/receivings')),
  ).toHaveLength(1);
  expect(load(scope)?.submission?.status).toBe('unknown');
  const receiptKey = calls.find((c) => c.url.endsWith('/receivings'))?.key;
  await u.click(form.getByRole('button', { name: 'Добавить в приёмку' }));
  await form.findByRole('alert');
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/variants')),
  ).toHaveLength(1);
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/receivings')),
  ).toHaveLength(2);
  expect(calls.find((c) => c.url.endsWith('/receivings'))?.key).toBe(
    receiptKey,
  );
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
  await u.type(form.getByLabelText('Закупочная цена, сом'), '1500');
  await u.click(
    form.getByRole('button', { name: 'Создать и провести приёмку' }),
  );
  await form.findByText(/Существующий принтер/);
  expect(load(scope)?.lines).toEqual([existing]);
  await u.click(form.getByRole('button', { name: 'Добавить в приёмку' }));
  await screen.findByText('Документ проведён: receipt');
  expect(
    calls.filter((c) => c.method === 'POST' && c.url.endsWith('/variants')),
  ).toHaveLength(1);
  expect(
    calls.some((c) => c.method === 'POST' && c.url.endsWith('/receivings')),
  ).toBe(true);
});
it('applies last purchase cost suggestion and opens receiving history details', async () => {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    let body: unknown = {};
    if (url.endsWith('/me'))
      body = {
        userId: scope.userId,
        email: 'employee@example.test',
        csrfToken: 'csrf',
        shops: [{ id: shop, name: 'Магазин', role: 'owner' }],
      };
    else if (url.includes('by-barcode'))
      body = {
        id: 'known-1',
        name: 'Кофе в зёрнах',
        barcode: '460111',
        salePriceMinor: 85000,
        lastPurchaseMinor: 62000,
      };
    else if (url.endsWith('/receivings') && method === 'GET')
      body = [
        {
          id: 'rec-1',
          documentNumber: 'ТТН-101',
          receivedOn: '2026-10-29',
          supplier: 'ОсОО Восток',
          totalMinor: 124000,
          createdBy: 'owner@example.test',
        },
      ];
    else if (url.endsWith('/receivings/rec-1'))
      body = {
        id: 'rec-1',
        documentNumber: 'ТТН-101',
        receivedOn: '2026-10-29',
        supplier: 'ОсОО Восток',
        comment: 'Утренняя поставка',
        totalMinor: 124000,
        createdBy: 'owner@example.test',
        lines: [
          {
            variantId: 'known-1',
            name: 'Кофе в зёрнах',
            barcode: '460111',
            quantity: 2,
            unitCostMinor: 62000,
            valueMinor: 124000,
          },
        ],
      };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/receiving']}>
      <App />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await u.type(
    await screen.findByLabelText('Сканировать штрихкод'),
    '460111{Enter}',
  );
  const applyLast = await screen.findByRole('button', {
    name: 'Последняя закупка: 620,00 сом',
  });
  await u.click(applyLast);
  expect(
    (
      screen.getByLabelText(
        'Закупочная цена Кофе в зёрнах, сом',
      ) as HTMLInputElement
    ).value,
  ).toBe('620');
  await u.click(await screen.findByRole('button', { name: 'Состав' }));
  await screen.findByText('Накладная ТТН-101');
  expect(screen.getByText(/Утренняя поставка/)).toBeTruthy();
  expect(screen.getAllByText('1 240,00 сом')).toHaveLength(2);
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
