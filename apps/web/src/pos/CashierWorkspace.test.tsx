import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import SalePage from './SalePage';
const { doc, api } = vi.hoisted(() => ({
  doc: {
    success: false,
    busy: false,
    blocked: false,
    online: true,
    draft: {
      lines: [{ id: 'v', quantity: 3, priceMinor: 10 }],
      submission: null,
    },
    addVariant: vi.fn(),
    send: vi.fn(),
    setError: vi.fn(),
  },
  api: vi.fn(),
}));
vi.mock('../drafts/use-document', () => ({ useDocument: () => doc }));
vi.mock('../drafts/DocumentEditor', () => ({ default: () => null }));
vi.mock('../auth/SessionProvider', () => ({
  useSession: () => ({ user: { userId: 'owner' } }),
}));
vi.mock('./use-current-shift', () => ({
  useCurrentShift: () => ({ current: { id: 'shift' }, loading: false }),
}));
vi.mock('../api/client', () => ({ api }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function start() {
  api.mockResolvedValue({
    items: [
      { id: 'available', name: 'Чашка', salePriceMinor: 10, available: 3 },
      { id: 'empty', name: 'Нет остатка', salePriceMinor: 10, available: 0 },
    ],
  });
  render(
    <MemoryRouter initialEntries={['/seller/shop/pos']}>
      <Routes>
        <Route path="/seller/:shopId/pos" element={<SalePage />} />
      </Routes>
    </MemoryRouter>,
  );
}
it('calculates change exactly and rejects overflowing or malformed received amounts', async () => {
  start();
  const received = screen.getByLabelText('Получено от покупателя, сом');
  fireEvent.change(received, { target: { value: '0,31' } });
  expect(screen.getByRole('status').textContent).toContain('0,01');
  fireEvent.change(received, { target: { value: '9'.repeat(400) } });
  expect(screen.getByRole('alert').textContent).toContain(
    'Сумма слишком велика',
  );
  fireEvent.change(received, { target: { value: '1.001' } });
  expect(screen.getByRole('alert').textContent).toContain(
    'точностью до тыйына',
  );
  expect(doc.send).not.toHaveBeenCalled();
});
it('adds an available product once and keeps unavailable products disabled', async () => {
  start();
  const available = await screen.findByRole('button', { name: /Чашка/ });
  fireEvent.click(available);
  expect(doc.addVariant).toHaveBeenCalledOnce();
  expect(
    (screen.getByRole('button', { name: /Нет остатка/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
