import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import LoyaltyCheckout from './LoyaltyCheckout';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shopId = '11111111-1111-4111-8111-111111111111';
const shiftId = '22222222-2222-4222-8222-222222222222';
const validToken = 'A'.repeat(43);

it('looks up customer profile by QR token and repays debt inline', async () => {
  const onDebtRepaid = vi.fn();
  const setPoints = vi.fn();
  let debtCleared = false;

  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith(`/shops/${shopId}/pos/loyalty/lookup`)) {
        return new Response(
          JSON.stringify({
            customerId: 'cust-1',
            name: 'Айгуль Токтосунова',
            phone: '+996700123456',
            bonusPoints: 150,
            totalDebtMinor: debtCleared ? 0 : 75000,
            openDebts: debtCleared
              ? []
              : [
                  {
                    saleId: 'sale-1',
                    totalMinor: 75000,
                    paidMinor: 0,
                    debtMinor: 75000,
                    dueOn: '2026-12-01',
                    createdAt: '2026-11-15T10:00:00.000Z',
                  },
                ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith(`/shops/${shopId}/pos/credit-sales/sale-1/repayments`)) {
        expect(init?.method).toBe('POST');
        const headers = init?.headers as Record<string, string>;
        expect(headers['idempotency-key']).toBeTruthy();
        expect(JSON.parse(String(init?.body))).toEqual({
          shiftId,
          method: 'card',
          amountMinor: 75000,
        });
        debtCleared = true;
        return new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ message: 'Not found' }), {
        status: 404,
      });
    },
  );
  vi.stubGlobal('fetch', fetchMock);

  render(
    <LoyaltyCheckout
      shopId={shopId}
      shiftId={shiftId}
      token={validToken}
      setToken={vi.fn()}
      points={0}
      setPoints={setPoints}
      totalMinor={100000}
      disabled={false}
      onDebtRepaid={onDebtRepaid}
    />,
  );

  await waitFor(() => {
    expect(screen.getByText('Айгуль Токтосунова')).toBeTruthy();
  });
  expect(screen.getByText('150 б.')).toBeTruthy();
  expect(screen.getByText('750,00 сом')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Весь долг' }));
  fireEvent.click(screen.getByRole('button', { name: 'Карта / QR' }));
  fireEvent.click(screen.getByRole('button', { name: 'Погасить' }));

  await waitFor(() => {
    expect(screen.getByText(/Долг погашен на 750,00\s+сом/)).toBeTruthy();
  });
  expect(onDebtRepaid).toHaveBeenCalledOnce();
  expect(screen.getByText('Нет долга')).toBeTruthy();

  // Max bonus for 1000 сом receipt (20%) = 200, capped by customer balance 150
  fireEvent.click(screen.getByRole('button', { name: 'Макс. 150' }));
  expect(setPoints).toHaveBeenCalledWith(150);
});
