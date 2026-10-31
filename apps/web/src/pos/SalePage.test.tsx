import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
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

  // Discount fields open from the compact cart line
  await u.click(screen.getByRole('button', { name: 'Скидка Куртка' }));
  const discountInput = screen.getByPlaceholderText('0');
  fireEvent.change(discountInput, { target: { value: '100' } }); // 100 Som discount

  // Reason input appears
  const reasonInput = await screen.findByPlaceholderText(
    'Причина (обязательно при скидке)',
  );
  await u.type(reasonInput, 'Сезонная акция');

  // Verify line discounted price, line sum, total tile and mobile paybar show 900 Som (1000 - 100)
  expect(screen.getAllByText('900,00 сом').length).toBe(4);

  const raw = localStorage.getItem('mystore:draft:cashier:' + shop + ':sale')!;
  expect(raw).toContain('"discountMinor":10000');
  expect(raw).toContain('Сезонная акция');
});

it('disables sale when entered cash is below total and calculates the correct change', async () => {
  const sales: string[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url.endsWith('/pos/sales') && init?.method === 'POST') {
      sales.push(url);
      return new Response(JSON.stringify({ id: 'sale-1' }));
    }
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
              name: 'Чайник',
              barcode: '11111',
              salePriceMinor: 150000,
            }
          : { items: [], total: 0, page: 1, pageSize: 24 };
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
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Сканировать штрихкод'),
    '11111{Enter}',
  );
  await screen.findByText('Чайник');
  const cashInput = screen.getByLabelText('Получено от покупателя, сом');
  fireEvent.change(cashInput, { target: { value: '1000' } });
  const pay = screen.getByRole('button', { name: 'Провести продажу' });
  expect(pay).toHaveProperty('disabled', true);
  expect(screen.getByText('Не хватает')).toBeTruthy();
  expect(sales).toHaveLength(0);

  fireEvent.change(cashInput, { target: { value: '2000' } });
  expect(screen.getByText('Сдача')).toBeTruthy();
  expect(screen.getByText('500,00 сом')).toBeTruthy();
  expect(pay).toHaveProperty('disabled', false);

  await user.click(screen.getByRole('button', { name: 'Без сдачи' }));
  expect((cashInput as HTMLInputElement).value).toBe('1500');
  expect(screen.getByText('0,00 сом')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: '2 000' }));
  expect((cashInput as HTMLInputElement).value).toBe('2000');
  expect(screen.getByRole('button', { name: '5 000' })).toBeTruthy();
});

it('stepper changes quantity, clears the cart and shows round cash suggestions', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'cashier',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Магазин', role: 'cashier' }],
        }
      : url.endsWith('/current')
        ? { id: 'shift', actorId: 'cashier', status: 'open' }
        : url.includes('/by-barcode')
          ? { id: 'v1', name: 'Молоко', barcode: '222', salePriceMinor: 4200 }
          : {
              items: [
                {
                  id: 'v1',
                  name: 'Молоко',
                  barcode: '222',
                  salePriceMinor: 4200,
                  available: 7,
                  category: 'Продукты',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 24,
              categories: [{ name: 'Продукты', count: 1 }],
            };
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
  const user = userEvent.setup();
  await screen.findByRole('button', { name: 'Продукты' });
  await user.click(await screen.findByRole('button', { name: /Молоко/ }));
  const quantity = (await screen.findByLabelText(
    'Количество Молоко',
  )) as HTMLInputElement;
  expect(quantity.value).toBe('1');
  await user.click(screen.getByRole('button', { name: 'Увеличить Молоко' }));
  await vi.waitFor(() => expect(quantity.value).toBe('2'));
  // 84 сом → 100, 500, 1 000
  expect(screen.getByRole('button', { name: '100' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '1 000' })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Уменьшить Молоко' }));
  await vi.waitFor(() => expect(quantity.value).toBe('1'));
  await user.click(screen.getByRole('button', { name: /Очистить/ }));
  await screen.findByText(/Корзина пуста/);
  const raw = localStorage.getItem('mystore:draft:cashier:' + shop + ':sale')!;
  expect(JSON.parse(raw).lines).toEqual([]);
});

it('supports New Receipt action, mobile payment bottom sheet and mode tabs', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'cashier',
          email: 'cashier@test.tld',
          csrfToken: 'csrf',
          shops: [{ id: shop, name: 'Юный инженер', role: 'cashier' }],
        }
      : url.endsWith('/current')
        ? { id: 'shift', actorId: 'cashier', status: 'open' }
        : url.includes('/by-barcode')
          ? {
              id: 'v1',
              name: 'Конструктор',
              barcode: '555',
              salePriceMinor: 63000,
            }
          : { items: [], total: 0, page: 1, pageSize: 24 };
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
  const user = userEvent.setup();
  const scanner = await screen.findByLabelText('Сканировать штрихкод');
  await user.type(scanner, '555{Enter}');
  await screen.findByText('Конструктор');

  const payBarBtn = screen.getByRole('button', {
    name: /Оплатить — 630,00 сом/,
  });
  await user.click(payBarBtn);
  expect(screen.getByText('Оплата чека')).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Закрыть оплату' }));

  await user.click(screen.getByRole('button', { name: /Новый чек/ }));
  await screen.findByText(/Корзина пуста/);
});
