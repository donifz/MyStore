import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BarcodeLabelsPage from './BarcodeLabelsPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('prints the selected product labels from the separate label section', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'item-1',
              name: 'Кружка',
              barcode: 'MS0123456789ABCDEF01234567',
              sku: 'MS-123456',
              salePriceMinor: 50000,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 100,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={['/seller/shop-1/labels']}>
      <Routes>
        <Route path="/seller/:shopId/labels" element={<BarcodeLabelsPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Кружка');
  await user.click(screen.getByRole('checkbox', { name: 'Выбрать Кружка' }));
  await user.click(screen.getByRole('button', { name: /^Печать выбранных/ }));

  expect(print).toHaveBeenCalledOnce();
  expect(screen.getByText('MS-123456')).toBeTruthy();
});

it('uses the chosen paper format and prints the requested number of labels', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: 'item-1',
              name: 'Кружка',
              barcode: 'MS0123456789ABCDEF01234567',
              sku: 'MS-123456',
              salePriceMinor: 50000,
            },
          ],
          total: 1,
          page: 1,
          pageSize: 100,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter initialEntries={['/seller/shop-1/labels']}>
      <Routes>
        <Route path="/seller/:shopId/labels" element={<BarcodeLabelsPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Кружка');
  await user.click(screen.getByRole('checkbox', { name: 'Выбрать Кружка' }));
  expect(container.querySelector('style')?.textContent).toContain(
    'size: 30mm 20mm',
  );

  await user.clear(
    screen.getByRole('spinbutton', { name: 'Количество наклеек для Кружка' }),
  );
  await user.type(
    screen.getByRole('spinbutton', { name: 'Количество наклеек для Кружка' }),
    '3',
  );
  expect(container.querySelectorAll('.barcode-label')).toHaveLength(3);

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Размер этикетки' }),
    '58x40',
  );
  expect(container.querySelector('style')?.textContent).toContain(
    'size: 58mm 40mm',
  );
  expect(container.querySelectorAll('.barcode-label--58x40')).toHaveLength(3);
});

it('loads every catalog page before printing all labels, without changing selected items', async () => {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const page = Number(
      new URL(url, 'http://localhost').searchParams.get('page'),
    );
    const product = {
      id: `item-${page}`,
      name: `Товар ${page}`,
      barcode: `MS0123456789ABCDEF0123456${page}`,
      sku: `MS-${page}`,
      salePriceMinor: 50000,
    };
    return new Response(
      JSON.stringify({
        items: [product],
        total: 2,
        page,
        pageSize: 100,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fetch);
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = userEvent.setup();
  const { container } = render(
    <MemoryRouter initialEntries={['/seller/shop-1/labels']}>
      <Routes>
        <Route path="/seller/:shopId/labels" element={<BarcodeLabelsPage />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Товар 1');
  await user.click(screen.getByRole('checkbox', { name: 'Выбрать Товар 1' }));
  await user.click(
    screen.getByRole('button', { name: 'Распечатать все товары' }),
  );

  await waitFor(() => expect(print).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('page=2&pageSize=100'),
  );
  expect(container.querySelectorAll('.barcode-label')).toHaveLength(2);
  expect(container.querySelectorAll('.barcode-label--30x20')).toHaveLength(2);
  window.dispatchEvent(new Event('afterprint'));
  await waitFor(() =>
    expect(container.querySelectorAll('.barcode-label')).toHaveLength(1),
  );
  expect(
    screen.getByRole('checkbox', { name: 'Выбрать Товар 1' }),
  ).toHaveProperty('checked', true);
});
