import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';
const saleId = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders sale details and allows previewing and printing receipt', async () => {
  const printMock = vi.fn();
  vi.stubGlobal('print', printMock);

  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'owner-id',
          email: 'owner@example.test',
          csrfToken: 'csrf',
          shops: [{ id: shopId, name: 'Магазин у дома', role: 'owner' }],
        }
      : url.includes('/pos/sales/' + saleId)
        ? {
            id: saleId,
            totalMinor: 45000,
            createdAt: '2026-10-17T12:00:00.000Z',
            shiftId: 'shift-1',
            method: 'cash',
            lines: [
              {
                id: 'line-1',
                variantId: 'v-1',
                name: 'Керамическая чашка',
                barcode: '123456789012',
                quantity: 2,
                returnedQuantity: 0,
                unitPriceMinor: 25000,
                discountMinor: 5000,
                discountReason: 'Акция выходного дня',
              },
            ],
          }
        : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={[`/seller/${shopId}/sales/${saleId}`]}>
      <App />
    </MemoryRouter>,
  );

  // Check main sale detail elements
  await screen.findByText('Продажа');
  await screen.findByText('Керамическая чашка');
  expect(screen.getAllByText('450,00 сом').length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getAllByText(/Акция выходного дня/).length,
  ).toBeGreaterThanOrEqual(1);

  // Test print button triggers window.print
  const printButtons = screen.getAllByRole('button', { name: 'Печать чека' });
  expect(printButtons.length).toBeGreaterThan(0);
  const user = userEvent.setup();
  await user.click(printButtons[0]);
  expect(printMock).toHaveBeenCalled();

  // Test receipt preview toggle
  const previewToggle = screen.getByRole('button', {
    name: 'Предпросмотр чека',
  });
  await user.click(previewToggle);
  expect(await screen.findByText('Предпросмотр товарного чека')).toBeTruthy();
  expect(screen.getAllByText('ТОВАРНЫЙ ЧЕК').length).toBeGreaterThanOrEqual(1);
  expect(screen.getAllByText('Магазин у дома').length).toBeGreaterThanOrEqual(
    1,
  );
  expect(screen.getAllByText('ИТОГО К ОПЛАТЕ:').length).toBeGreaterThanOrEqual(
    1,
  );
  expect(
    screen.getAllByText('Не является фискальным чеком').length,
  ).toBeGreaterThanOrEqual(1);

  // Toggle off
  await user.click(screen.getByRole('button', { name: 'Скрыть чек' }));
  expect(screen.queryByText('Предпросмотр товарного чека')).toBeNull();
});
