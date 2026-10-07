import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  localStorage.clear();
});
function mock(
  data: any = { items: [], total: 0, page: 1, pageSize: 24, categories: [] },
  status = 200,
) {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(JSON.stringify(url.endsWith('/me') ? {} : data), {
        status: url.endsWith('/me') ? 401 : status,
        headers: { 'content-type': 'application/json' },
      }),
  );
}
function open(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}
it('shows buyer catalog with empty state and partner entry in footer without seller sign-in', async () => {
  mock();
  open();
  await screen.findByRole('heading', {
    name: 'Найдите своё в магазинах рядом',
  });
  await screen.findByText('Товары пока не опубликованы.');
  expect(
    screen.getByRole('link', { name: 'Стать партнёром' }).getAttribute('href'),
  ).toBe('/partner');
});
it('does not pretend a failed catalog request is an empty catalog', async () => {
  mock({}, 500);
  open();
  await screen.findByRole('alert');
  expect(screen.queryByText('Товары пока не опубликованы.')).toBeNull();
});
it('displays public product availability and contact purchase without cost fields', async () => {
  mock({
    id: 'p',
    name: 'Чашка',
    description: 'Керамика',
    category: 'Посуда',
    salePriceMinor: 15000,
    available: 3,
    store: {
      slug: 's',
      name: 'Магазин',
      city: 'Ош',
      phone: '+996700123456',
      address: 'Центр',
      hours: '10–19',
    },
  });
  open('/shops/s/products/p');
  await screen.findByRole('heading', { name: 'Чашка' });
  expect(screen.getByText('В наличии: 3 шт.').isConnected).toBe(true);
  expect(
    screen
      .getByRole('link', { name: 'Связаться с магазином' })
      .getAttribute('href'),
  ).toBe('tel:+996700123456');
  expect(screen.queryByText(/себестоимость/i)).toBeNull();
});
it('shows confirmation after partner signup and does not keep the password in storage', async () => {
  mock({ created: true });
  open('/partner');
  const u = userEvent.setup();
  await u.type(await screen.findByLabelText('Название магазина'), 'Дом');
  await u.type(screen.getByLabelText('Email'), 'new@example.test');
  await u.type(screen.getByLabelText('Пароль'), 'partner-test-password');
  await u.click(screen.getByRole('button', { name: 'Создать магазин' }));
  await screen.findByText('Магазин создан. Войдите, чтобы настроить витрину.');
  expect(screen.queryByLabelText('Пароль')).toBeNull();
  expect(JSON.stringify(localStorage)).not.toContain('partner-test-password');
});
it('shows missing product as unavailable and offers catalog navigation', async () => {
  mock({}, 404);
  open('/shops/missing/products/p');
  await screen.findByText('Товар недоступен или снят с публикации.');
  expect(
    screen
      .getByRole('link', { name: 'Вернуться в каталог' })
      .getAttribute('href'),
  ).toBe('/');
});

it('ignores an older catalog response after the buyer changes search', async () => {
  const pending: { url: string; resolve: (r: Response) => void }[] = [];
  vi.stubGlobal('fetch', (url: string) =>
    url.endsWith('/me')
      ? Promise.resolve(new Response('{}', { status: 401 }))
      : new Promise<Response>((resolve) => pending.push({ url, resolve })),
  );
  open();
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Поиск'), 'x');
  const body = (name: string) => ({
    items: [
      {
        id: name,
        name,
        salePriceMinor: 100,
        available: 1,
        category: '',
        store: { slug: 's', name: 'Shop', city: 'Ош' },
      },
    ],
    total: 1,
    page: 1,
    pageSize: 24,
    categories: [],
  });
  await act(async () => {
    pending
      .find((x) => x.url.includes('q=x'))!
      .resolve(new Response(JSON.stringify(body('Новый результат'))));
  });
  await screen.findByText('Новый результат');
  await act(async () => {
    pending
      .find((x) => x.url.includes('q=&'))!
      .resolve(new Response(JSON.stringify(body('Старый результат'))));
  });
  expect(screen.queryByText('Старый результат')).toBeNull();
  expect(screen.getByText('Новый результат').isConnected).toBe(true);
});

it('cashier cannot load storefront settings', async () => {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(url);
    return new Response(
      JSON.stringify({
        userId: 'u',
        email: 'cashier@example.test',
        csrfToken: 'c',
        shops: [{ id: 's', name: 'Store', role: 'cashier' }],
      }),
    );
  });
  open('/seller/s/storefront');
  await screen.findByText('Настройка витрины доступна владельцу.');
  expect(calls.some((x) => x.endsWith('/storefront'))).toBe(false);
});

it('allows further price editing after saving without rendering a draft as a saved price', async () => {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/me')
            ? {
                userId: 'u',
                email: 'owner@example.test',
                csrfToken: 'c',
                shops: [{ id: 's', name: 'Store', role: 'owner' }],
              }
            : {
                id: 'v',
                name: 'Чашка',
                barcode: '123',
                salePriceMinor: 15000,
                description: '',
                category: '',
                published: true,
              },
        ),
      ),
  );
  open('/seller/s/products/v/edit');
  const u = userEvent.setup();
  await screen.findByLabelText('Цена продажи, сом');
  await u.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await screen.findByRole('status');
  await u.clear(screen.getByLabelText('Цена продажи, сом'));
  expect(screen.getByLabelText('Цена продажи, сом').getAttribute('value')).toBe(
    '',
  );
});

for (const path of ['/?page=2', '/shops?page=2'])
  it(`keeps backward navigation after results shrink on ${path}`, async () => {
    mock({ items: [], total: 24, page: 2, pageSize: 24, categories: [] });
    open(path);
    await screen.findByRole('button', { name: 'Назад' });
    expect(
      screen.getByRole('button', { name: 'Назад' }).hasAttribute('disabled'),
    ).toBe(false);
  });

it('refreshes a product quantity on the polling interval and on focus', async () => {
  let available = 5;
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/me')
            ? {}
            : {
                id: 'p',
                name: 'Чашка',
                description: '',
                category: '',
                salePriceMinor: 15000,
                available,
                store: {
                  slug: 's',
                  name: 'Store',
                  city: 'Ош',
                  phone: '+996700123456',
                },
              },
        ),
        { status: url.endsWith('/me') ? 401 : 200 },
      ),
  );
  vi.useFakeTimers();
  open('/shops/s/products/p');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByText('В наличии: 5 шт.').isConnected).toBe(true);
  available = 3;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30000);
  });
  expect(screen.getByText('В наличии: 3 шт.').isConnected).toBe(true);
  available = 1;
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(screen.getByText('В наличии: 1 шт.').isConnected).toBe(true);
});
