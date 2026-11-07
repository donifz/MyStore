import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import CreditFields from './CreditFields';

const shopId = '11111111-1111-4111-8111-111111111111';
const customerId = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('allows an unverified buyer to be selected for credit', async () => {
  vi.stubGlobal(
    'fetch',
    async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              id: customerId,
              name: 'Нурлан',
              phone: '+996700123456',
              linked: false,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
  );
  const onCustomerChange = vi.fn();
  const onCustomerEligible = vi.fn();
  render(
    <CreditFields
      shopId={shopId}
      enabled
      disabled={false}
      customerId=""
      onCustomerChange={onCustomerChange}
      onCustomerEligible={onCustomerEligible}
      paid="0"
      onPaidChange={vi.fn()}
      dueOn=""
      onDueChange={vi.fn()}
      debtMinor={100000}
    />,
  );
  const customer = await screen.findByRole('button', { name: /Нурлан/ });
  expect(customer.textContent).toContain('Кабинет не подтверждён');
  fireEvent.click(customer);
  expect(onCustomerChange).toHaveBeenCalledWith(customerId);
  expect(onCustomerEligible).toHaveBeenCalledWith(true);
});

it('immediately selects a newly created customer before QR activation', async () => {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const body =
      init?.method === 'POST' && url.endsWith('/customers')
        ? { id: customerId, name: 'Азамат', linked: false }
        : url.endsWith('/invite')
          ? { token: 'a'.repeat(43), expiresAt: '2099-12-31T00:00:00.000Z' }
          : { items: [], total: 0, page: 1, pageSize: 100 };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  const onCustomerChange = vi.fn();
  const onCustomerEligible = vi.fn();
  render(
    <CreditFields
      shopId={shopId}
      enabled
      disabled={false}
      customerId=""
      onCustomerChange={onCustomerChange}
      onCustomerEligible={onCustomerEligible}
      paid="0"
      onPaidChange={vi.fn()}
      dueOn=""
      onDueChange={vi.fn()}
      debtMinor={100000}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /Новый клиент/ }));
  fireEvent.change(screen.getByPlaceholderText('Азамат'), {
    target: { value: 'Азамат' },
  });
  fireEvent.change(screen.getByPlaceholderText('+996 700 123 456'), {
    target: { value: '0700123456' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: /Создать и показать QR/ }),
  );
  await waitFor(() => {
    expect(onCustomerChange).toHaveBeenCalledWith(customerId);
    expect(onCustomerEligible).toHaveBeenCalledWith(true);
  });
});
