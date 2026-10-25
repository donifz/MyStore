import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { save } from '../drafts/draft-store';
const shop = '11111111-1111-4111-8111-111111111111';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
it('legacy scan/photo URL opens the single create form and Enter scanning never submits it', async () => {
  const posts: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (init?.method === 'POST') posts.push(url);
    const body = url.endsWith('/me')
      ? {
          userId: 'owner',
          email: 'owner@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Shop', role: 'owner' }],
        }
      : url.endsWith('/photo-assistant')
        ? { available: false, categories: [] }
        : [];
    return new Response(JSON.stringify(body));
  });
  render(
    <MemoryRouter initialEntries={[`/seller/${shop}/products/capture`]}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByRole('heading', { name: 'Добавить товар' });
  expect(screen.getByLabelText('Фото товара')).toBeTruthy();
  expect(screen.queryByLabelText('Количество', { exact: true })).toBeNull();
  expect(screen.queryByLabelText('Закупочная цена, сом')).toBeNull();
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Название', { exact: true }), 'Принтер');
  await u.type(screen.getByLabelText('Цена продажи, сом'), '2000');
  await u.type(
    screen.getByLabelText('Штрихкод', { exact: true }),
    '000123{Enter}',
  );
  expect(posts).toHaveLength(0);
  expect(
    (screen.getByLabelText('Штрихкод', { exact: true }) as HTMLInputElement)
      .value,
  ).toBe('000123');
});
it('inline receiving creation uses the same photo and barcode form', async () => {
  const { default: ReceivingProductForm } =
    await import('../receiving/ReceivingProductForm');
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(JSON.stringify({ available: false, categories: [] })),
  );
  render(
    <ReceivingProductForm
      shopId={shop}
      barcode="00012"
      disabled={false}
      onCancel={() => {}}
      onCreated={async () => true}
    />,
  );
  expect(screen.getByLabelText('Фото товара')).toBeTruthy();
  expect((screen.getByLabelText('Штрихкод') as HTMLInputElement).value).toBe(
    '00012',
  );
  fireEvent.keyDown(screen.getByLabelText('Штрихкод'), { key: 'Enter' });
});

it('primary submit resets a previous failed secondary intent', async () => {
  const { default: ProductForm } = await import('./ProductForm');
  let attempts = 0;
  const primary = vi.fn(async () => true);
  const secondary = vi.fn(async () => true);
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/photo-assistant'))
      return new Response(JSON.stringify({ available: false, categories: [] }));
    if (url.endsWith('/variants') && init?.method === 'POST') {
      attempts++;
      return new Response(
        JSON.stringify(
          attempts === 1
            ? { message: 'temporary failure' }
            : {
                id: 'created',
                name: 'Принтер',
                barcode: 'MS1',
                salePriceMinor: 200000,
              },
        ),
        { status: attempts === 1 ? 500 : 201 },
      );
    }
    return new Response(JSON.stringify([]));
  });
  render(
    <ProductForm
      shopId={shop}
      onSaved={primary}
      onSecondarySaved={secondary}
      secondarySubmitLabel="Создать без приёмки"
    />,
  );
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Название', { exact: true }), 'Принтер');
  await u.type(screen.getByLabelText('Цена продажи, сом'), '2000');
  await u.click(screen.getByRole('button', { name: 'Создать без приёмки' }));
  await screen.findByRole('alert');
  await u.click(screen.getByRole('button', { name: 'Сохранить товар' }));
  expect(primary).toHaveBeenCalledTimes(1);
  expect(secondary).not.toHaveBeenCalled();
});

it('keeps an uncertain legacy photo receiving request available with its original key and body', async () => {
  const body = {
    name: 'Old cup',
    quantity: 3,
    unitCostMinor: 8000,
    salePriceMinor: 15000,
    photoDataUrl: 'photo',
    category: 'Посуда',
    description: 'Old',
    barcode: '00000000',
  };
  save({
    version: 1,
    scope: { userId: 'owner', shopId: shop, kind: 'capture' },
    revision: 'old-revision',
    lines: [],
    submission: {
      key: 'old-key',
      path: `/shops/${shop}/variants/capture`,
      body,
      status: 'unknown',
    },
  });
  const posts: { key: string | null; body: unknown }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let response: unknown = {};
    if (url.endsWith('/me'))
      response = {
        userId: 'owner',
        email: 'owner@test.tld',
        csrfToken: 'csrf',
        shops: [{ id: shop, name: 'Shop', role: 'owner' }],
      };
    else if (init?.method === 'POST') {
      posts.push({
        key: new Headers(init.headers).get('idempotency-key'),
        body: JSON.parse(init.body as string),
      });
      response = {
        id: 'cup',
        name: body.name,
        barcode: body.barcode,
        salePriceMinor: body.salePriceMinor,
        quantity: 3,
      };
    }
    return new Response(JSON.stringify(response));
  });
  render(
    <MemoryRouter initialEntries={[`/seller/${shop}/products/capture`]}>
      <App />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await u.click(
    await screen.findByRole('button', { name: 'Повторить сохранение' }),
  );
  await screen.findByText('Товар создан и принят: 3 шт.');
  expect(posts).toEqual([{ key: 'old-key', body }]);
});
