import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
const shop = '11111111-1111-4111-8111-111111111111';
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});
function server(role = 'cashier', variantItems?: Record<string, unknown>[]) {
  let calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push((init?.method || 'GET') + ' ' + url);
    let body: any = url.endsWith('/me')
      ? {
          userId: 'user',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role }],
        }
      : url.endsWith('/categories')
        ? []
        : url.endsWith('/variants') && init?.method === 'POST'
          ? {
              id: 'created-variant',
              name: 'Сумка',
              barcode: 'MS0123456789ABCDEF01234567',
              sku: 'MS-00000001',
              salePriceMinor: 15025,
            }
          : url.includes('/variants')
            ? {
                items: variantItems ?? [
                  {
                    id: 'variant',
                    name: 'Рюкзак',
                    barcode: '00123',
                    salePriceMinor: 15000,
                    physical: 10,
                    reserved: 0,
                    available: 10,
                    createdAt: '2026-11-05T09:30:00.000Z',
                  },
                ],
                total: variantItems?.length ?? 1,
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
  expect(screen.queryByRole('columnheader', { name: 'Закупочная' })).toBeNull();
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
  await screen.findByText(
    'Нет доступа к этому разделу. Выберите доступный контекст.',
  );
  expect(calls.some((x) => x.includes('/shops/foreign/'))).toBe(false);
});
it('lets a cashier preview and print a product barcode label', async () => {
  server();
  const app = await import('../App');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await screen.findByText('Рюкзак');
  await u.click(screen.getByRole('button', { name: 'Штрихкод' }));
  expect(screen.getByRole('dialog', { name: 'Этикетка: Рюкзак' })).toBeTruthy();
  expect(screen.getAllByText('00123')).toHaveLength(2);
  await u.click(screen.getByRole('button', { name: 'Печать этикетки' }));
  expect(print).toHaveBeenCalledOnce();
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
  await u.type(screen.getByLabelText('Закупочная цена, сом'), '100');
  await u.click(screen.getByRole('button', { name: 'Добавить в приёмку' }));
  await screen.findByText('Товар добавлен в список приёмки.');
  const postedVariant = calls.some(
    (x) => x.startsWith('POST ') && x.endsWith('/variants'),
  );
  const postedReceiving = calls.some(
    (x) => x.startsWith('POST ') && x.endsWith('/receivings'),
  );
  expect(postedVariant).toBe(true);
  expect(postedReceiving).toBe(false);
});
it('filters catalog variants by stock availability', async () => {
  const calls = server('owner');
  const app = await import('../App');
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  const u = userEvent.setup();
  await screen.findByText('Рюкзак');
  await u.selectOptions(screen.getByLabelText('Наличие'), 'low');
  await vi.waitFor(() =>
    expect(calls.some((x) => x.includes('stock=low'))).toBe(true),
  );
});

it('loads newest products first and requests sorting before pagination', async () => {
  const calls = server('owner');
  const app = await import('../App');
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByText('Рюкзак');
  expect(calls.some((call) => call.includes('sort=newest'))).toBe(true);
  const user = userEvent.setup();
  await user.selectOptions(screen.getByLabelText('Сортировка'), 'price-desc');
  await vi.waitFor(() =>
    expect(calls.some((call) => call.includes('sort=price-desc'))).toBe(true),
  );
});

it('displays the product creation date returned by the catalog API', async () => {
  server('owner');
  const app = await import('../App');
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByText('Рюкзак');
  expect(screen.getByRole('columnheader', { name: 'Добавлен' })).toBeTruthy();
  expect(screen.getByText(/05\.11\.2026/)).toBeTruthy();
});

it('shows purchase price for non-cashiers and product photo with default fallback', async () => {
  server('owner', [
    {
      id: 'v1',
      name: 'Рюкзак',
      barcode: '00123',
      salePriceMinor: 15000,
      lastPurchaseMinor: 10000,
      photoUrl: '/api/v1/shops/' + shop + '/variants/v1/photo',
      physical: 10,
      reserved: 0,
      available: 10,
      createdAt: '2026-11-05T09:30:00.000Z',
    },
    {
      id: 'v2',
      name: 'Пенал',
      barcode: '00124',
      salePriceMinor: 5000,
      physical: 4,
      reserved: 0,
      available: 4,
      createdAt: '2026-11-05T10:00:00.000Z',
    },
  ]);
  const app = await import('../App');
  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByText('Рюкзак');
  expect(screen.getByRole('columnheader', { name: 'Закупочная' })).toBeTruthy();
  expect(screen.getByText('100,00 сом')).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();

  const img = screen.getByRole('img', { name: 'Рюкзак' }) as HTMLImageElement;
  expect(img.getAttribute('src')).toBe(
    '/api/v1/shops/' + shop + '/variants/v1/photo',
  );
  expect(screen.getAllByLabelText('Фото по умолчанию')).toHaveLength(1);

  fireEvent.error(img);
  expect(screen.queryByRole('img', { name: 'Рюкзак' })).toBeNull();
  expect(screen.getAllByLabelText('Фото по умолчанию')).toHaveLength(2);
});

it('renders barcode scanner icon button and maintains focus on search input', async () => {
  server('owner');
  const app = await import('../App');
  const u = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByText('Рюкзак');

  const searchInput = screen.getByLabelText('Поиск') as HTMLInputElement;
  expect(searchInput).toBeTruthy();
  expect(searchInput.getAttribute('placeholder')).toBe('Название или штрихкод');

  const scannerBtn = screen.getByRole('button', { name: 'Фокус для сканера' });
  expect(scannerBtn).toBeTruthy();

  const cameraBtn = screen.getByRole('button', { name: 'Сканировать камерой' });
  expect(cameraBtn).toBeTruthy();

  // Test typing in search input
  await u.type(searchInput, '00123');
  expect(searchInput.value).toBe('00123');

  // Test clear button
  const clearBtn = screen.getByRole('button', { name: 'Очистить поиск' });
  expect(clearBtn).toBeTruthy();
  await u.click(clearBtn);
  expect(searchInput.value).toBe('');

  // Clicking scanner button refocuses search input
  await u.click(scannerBtn);
  expect(document.activeElement).toBe(searchInput);

  // Clicking camera button opens camera modal dialog
  await u.click(cameraBtn);
  expect(
    await screen.findByRole('heading', { name: 'Сканировать камерой' }),
  ).toBeTruthy();

  // Close modal via close button
  const closeBtn = screen.getByRole('button', { name: 'Закрыть' });
  await u.click(closeBtn);
  expect(
    screen.queryByRole('heading', { name: 'Сканировать камерой' }),
  ).toBeNull();
  expect(document.activeElement).toBe(searchInput);
});

it('filters catalog by visibility and initializes filters from URL query params', async () => {
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
      : url.includes('/variants')
        ? {
            items: [
              {
                id: 'v1',
                name: 'Конструктор',
                barcode: '00999',
                salePriceMinor: 25000,
                physical: 3,
                reserved: 0,
                available: 3,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 25,
            facets: [{ name: 'Игрушки', count: 5 }],
          }
        : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const app = await import('../App');
  render(
    <MemoryRouter
      initialEntries={['/seller/' + shop + '/products?stock=low&sort=popular']}
    >
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByText('Конструктор');
  expect(
    calls.some(
      (u) =>
        u.includes('/variants') &&
        u.includes('stock=low') &&
        u.includes('sort=popular'),
    ),
  ).toBe(true);

  const u = userEvent.setup();
  await u.selectOptions(screen.getByLabelText('Категория'), 'Игрушки');
  await u.selectOptions(screen.getByLabelText('Витрина и фото'), 'no_photo');
  await vi.waitFor(() =>
    expect(
      calls.some(
        (x) =>
          x.includes('category=%D0%98%D0%B3%D1%80%D1%83%D1%88%D0%BA%D0%B8') &&
          x.includes('visibility=no_photo'),
      ),
    ).toBe(true),
  );
});

it('lets user select multiple products and print labels via bulk modal with +/- steppers', async () => {
  server('owner', [
    {
      id: 'v1',
      name: 'Рюкзак',
      barcode: '00123',
      salePriceMinor: 15000,
      physical: 10,
      reserved: 0,
      available: 10,
      createdAt: '2026-11-05T09:30:00.000Z',
    },
    {
      id: 'v2',
      name: 'Пенал',
      barcode: '00456',
      salePriceMinor: 5000,
      physical: 4,
      reserved: 0,
      available: 4,
      createdAt: '2026-11-05T09:35:00.000Z',
    },
  ]);
  const app = await import('../App');
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const { container } = render(
    <MemoryRouter initialEntries={['/seller/' + shop + '/products']}>
      <app.default />
    </MemoryRouter>,
  );

  const u = userEvent.setup();
  await screen.findByText('Рюкзак');
  expect(
    screen.queryByRole('region', { name: 'Массовые действия' }),
  ).toBeNull();

  await u.click(screen.getByLabelText('Выбрать все товары на странице'));
  const bulkBar = screen.getByRole('region', { name: 'Массовые действия' });
  expect(bulkBar.textContent).toContain('Выбрано: 2');

  await u.click(screen.getByRole('button', { name: 'Печать этикеток' }));
  const dialog = screen.getByRole('dialog', { name: 'Печать этикеток' });
  expect(dialog).toBeTruthy();

  await u.click(screen.getByLabelText('Увеличить количество для Рюкзак'));
  await u.click(screen.getByLabelText('Увеличить количество для Рюкзак'));
  await u.click(screen.getByLabelText('Уменьшить количество для Рюкзак'));
  expect(
    (
      screen.getByLabelText(
        'Количество этикеток для Рюкзак',
      ) as HTMLInputElement
    ).value,
  ).toBe('2');

  expect(
    container.querySelectorAll('.catalog-bulk-print-sheet .barcode-label'),
  ).toHaveLength(3);

  await u.click(screen.getByRole('button', { name: 'Печать (3)' }));
  expect(print).toHaveBeenCalledOnce();

  await u.click(screen.getByLabelText('Убрать Пенал из печати'));
  expect(
    container.querySelectorAll('.catalog-bulk-print-sheet .barcode-label'),
  ).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Печать (2)' })).toBeTruthy();

  await u.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('dialog', { name: 'Печать этикеток' })).toBeNull();

  await u.click(screen.getByRole('button', { name: 'Снять выделение' }));
  expect(
    screen.queryByRole('region', { name: 'Массовые действия' }),
  ).toBeNull();
});
