import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const shop = '11111111-1111-4111-8111-111111111111';
const variantId = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function mockServer({
  role = 'owner',
  archived = false,
  photoUrl,
}: {
  role?: 'owner' | 'manager' | 'cashier';
  archived?: boolean;
  photoUrl?: string;
} = {}) {
  let currentArchived = archived;
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    let body: unknown = {};
    if (url.endsWith('/me')) {
      body = {
        userId: 'u1',
        email: 'owner@example.test',
        csrfToken: 'csrf',
        shops: [{ id: shop, name: 'Мир игрушек', role }],
      };
    } else if (url.includes(`/variants/${variantId}/variants`)) {
      body = [
        {
          id: variantId,
          name: 'Снежколеп',
          barcode: '2000000008310',
          shortBarcode: '00000831',
          size: 'Средний',
          color: 'Синий',
          archived: currentArchived,
          salePriceMinor: 10000,
          available: 4,
        },
      ];
    } else if (
      url.includes(`/variants/${variantId}/archive`) &&
      init?.method === 'PUT'
    ) {
      currentArchived = true;
      body = { id: variantId, archived: true };
    } else if (
      url.includes(`/variants/${variantId}/unarchive`) &&
      init?.method === 'PUT'
    ) {
      currentArchived = false;
      body = { id: variantId, archived: false };
    } else if (
      url.includes(`/variants/${variantId}`) &&
      init?.method === 'PUT'
    ) {
      const payload = JSON.parse(String(init.body));
      body = {
        id: variantId,
        name: payload.name,
        barcode: '2000000008310',
        shortBarcode: '00000831',
        salePriceMinor: payload.salePriceMinor,
        published: payload.published,
        publicationStatus: 'pending',
      };
    } else if (url.includes(`/variants/${variantId}`)) {
      body = {
        id: variantId,
        sku: 'SN-01',
        name: 'Снежколеп',
        barcode: '2000000008310',
        shortBarcode: '00000831',
        size: 'Средний',
        color: 'Синий',
        archived: currentArchived,
        salePriceMinor: 10000,
        lastPurchaseMinor: 6500,
        physical: 5,
        reserved: 1,
        available: 4,
        category: 'Зимние игрушки',
        subcategory: 'Игры на улице',
        description: 'Прочный пластиковый снежколеп',
        published: true,
        publicationStatus: 'approved',
        ...(photoUrl ? { photoUrl, photoUrls: [photoUrl] } : {}),
        attributes: {},
      };
    } else if (url.includes('/categories')) {
      body = [
        {
          id: 'cat1',
          name: 'Зимние игрушки',
          children: [{ id: 'sub1', name: 'Игры на улице', children: [] }],
        },
      ];
    } else if (url.includes('/custom-attributes')) {
      body = [];
    } else if (url.includes('/inventory/counts') && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body));
      body = {
        id: 'doc-count-001',
        kind: 'inventory_count',
        delta: payload.countedQuantity - payload.expectedQuantity,
        valueMinor: 0,
      };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
}

it('renders hero KPI summary, cost margin calculation, and switches product detail tabs', async () => {
  mockServer({ photoUrl: `/api/shops/${shop}/variants/${variantId}/photo` });
  const app = await import('../App');
  const u = userEvent.setup();

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/products/${variantId}/edit`]}
    >
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByLabelText('Цена продажи, сом');
  expect(screen.getByRole('heading', { name: 'Снежколеп' })).toBeTruthy();
  expect(screen.getByText('Активен')).toBeTruthy();
  expect(screen.getByText('Одобрен на витрине')).toBeTruthy();
  expect(screen.getAllByText('65,00 сом').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('+53,8%')).toBeTruthy();
  expect(screen.getByText(/\+35,00 сом/)).toBeTruthy();
  expect(screen.getByText('4 шт.')).toBeTruthy();

  await u.click(screen.getByRole('tab', { name: 'Фотографии (1)' }));
  await screen.findByRole('heading', { name: 'Фотографии товара' });

  await u.click(screen.getByRole('tab', { name: 'Разновидности (1)' }));
  await screen.findByRole('heading', {
    name: 'Разновидности (размеры / цвета)',
  });
  expect(screen.getByText(/\(текущий\)/)).toBeTruthy();

  await u.click(screen.getByRole('tab', { name: 'Склад и штрихкод' }));
  await screen.findByRole('heading', { name: 'Остатки на складе' });
  expect(screen.getAllByText('5 шт.').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('img', { name: 'Штрихкод' })).toBeTruthy();

  await u.click(screen.getByRole('tab', { name: 'Витрина и архив' }));
  await screen.findByRole('heading', { name: 'Управление архивом' });
  await u.click(
    screen.getByRole('button', { name: 'Перенести товар в архив' }),
  );
  await screen.findByText('В архиве');
});

it('shows default thumbnail fallback when no photo exists and opens label dialog', async () => {
  mockServer();
  const app = await import('../App');
  const u = userEvent.setup();

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/products/${variantId}/edit`]}
    >
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByLabelText('Цена продажи, сом');
  expect(screen.getByLabelText('Фото по умолчанию')).toBeTruthy();

  await u.click(screen.getByRole('button', { name: 'Этикетка' }));
  const dialog = await screen.findByRole('dialog', {
    name: 'Этикетка: Снежколеп',
  });
  expect(dialog).toBeTruthy();
  await u.click(screen.getByRole('button', { name: 'Закрыть' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('updates profit preview live when price changes and saves edits', async () => {
  mockServer();
  const app = await import('../App');
  const u = userEvent.setup();

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/products/${variantId}/edit`]}
    >
      <app.default />
    </MemoryRouter>,
  );

  const priceInput = await screen.findByLabelText('Цена продажи, сом');
  await u.clear(priceInput);
  await u.type(priceInput, '130');
  expect(screen.getByText(/\+65,00 сом/)).toBeTruthy();

  await u.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
  await screen.findByText('Товар обновлён. Цена: 130,00 сом');
});

it('blocks cashier from editing product details', async () => {
  mockServer({ role: 'cashier' });
  const app = await import('../App');

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/products/${variantId}/edit`]}
    >
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByRole('alert');
  expect(
    screen.getByText(
      'Нет доступа к этому разделу. Выберите доступный контекст.',
    ),
  ).toBeTruthy();
});

it('allows easily increasing and decreasing stock according to accounting rules', async () => {
  mockServer();
  const app = await import('../App');
  const u = userEvent.setup();

  render(
    <MemoryRouter
      initialEntries={[`/seller/${shop}/products/${variantId}/edit`]}
    >
      <app.default />
    </MemoryRouter>,
  );

  await screen.findByLabelText('Цена продажи, сом');

  // Navigate to Stock tab
  await u.click(screen.getByRole('tab', { name: 'Склад и штрихкод' }));
  await screen.findByRole('heading', { name: 'Остатки на складе' });

  // Initial stock: physical 5, reserved 1, available 4
  const input = screen.getByLabelText(
    'Фактическое количество',
  ) as HTMLInputElement;
  expect(input).toBeTruthy();
  expect(input.value).toBe('5');

  // Initially delta is 0, submit button shows "Укажите новое количество" and is disabled
  const submitBtn = screen.getByRole('button', {
    name: 'Укажите новое количество',
  });
  expect(submitBtn.hasAttribute('disabled')).toBe(true);

  // Click "+" button to increase to 6 (+1)
  const plusBtn = screen.getByRole('button', { name: 'Увеличить на 1' });
  await u.click(plusBtn);
  expect(input.value).toBe('6');
  expect(screen.getAllByText(/\+1 шт\./).length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getByRole('button', { name: 'Оприходовать +1 шт.' }),
  ).toBeTruthy();

  // Click "−" button twice to decrease to 4 (-1 from original 5)
  const minusBtn = screen.getByRole('button', { name: 'Уменьшить на 1' });
  await u.click(minusBtn);
  expect(input.value).toBe('5');
  await u.click(minusBtn);
  expect(input.value).toBe('4');
  expect(screen.getAllByText(/-1 шт\./).length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('button', { name: 'Списать 1 шт.' })).toBeTruthy();

  // Click "+5" chip to jump to 9 (+4 from original 5)
  await u.click(screen.getByRole('button', { name: '+5' }));
  expect(input.value).toBe('9');
  expect(screen.getAllByText(/\+4 шт\./).length).toBeGreaterThanOrEqual(1);

  // Submit the adjustment
  const countSubmitBtn = screen.getByRole('button', {
    name: 'Оприходовать +4 шт.',
  });
  await u.click(countSubmitBtn);

  // Success alert is shown with accounting confirmation
  await screen.findByText(/Документ инвентаризации зафиксирован/);
  expect(screen.getByText(/Остаток успешно изменён: 9 шт\./)).toBeTruthy();

  // Stock KPI and tiles update
  expect(screen.getAllByText('9 шт.').length).toBeGreaterThanOrEqual(1);
  // Available should now be 9 - 1 (reserved) = 8
  expect(screen.getAllByText('8 шт.').length).toBeGreaterThanOrEqual(1);
});
