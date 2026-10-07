import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
