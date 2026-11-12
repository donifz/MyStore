import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ShopCustomersPage from './ShopCustomersPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const shopId = '11111111-1111-4111-8111-111111111111';
// Exactly 43 base64url characters as expected by buyerInviteLink
const validToken = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP1';

const mockSummary = {
  totalCustomers: 2,
  debtorsCount: 1,
  totalDebtMinor: 150000,
  linkedCount: 1,
};

const mockCustomers = [
  {
    id: 'c-1',
    name: 'Азамат Исаев',
    phone: '+996700111222',
    address: 'г. Бишкек',
    createdAt: '2026-02-01T10:00:00.000Z',
    linked: true,
    debtMinor: 150000,
    balancePoints: 50,
  },
  {
    id: 'c-2',
    name: 'Бегимай Осмонова',
    phone: '+996555333444',
    address: null,
    createdAt: '2026-02-05T12:00:00.000Z',
    linked: false,
    debtMinor: 0,
    balancePoints: 0,
  },
];

const mockCreditSales = [
  {
    saleId: 'sale-101',
    totalMinor: 200000,
    paidMinor: 50000,
    debtMinor: 150000,
    dueOn: '2026-12-01',
    createdAt: '2026-02-02T10:00:00.000Z',
  },
];

const mockRepayments = [
  {
    id: 'rep-1',
    amountMinor: 50000,
    method: 'cash',
    createdAt: '2026-02-03T11:00:00.000Z',
  },
];

function setupFetch(customSales = mockCreditSales) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.includes('/shifts/current')) {
        return new Response(
          JSON.stringify({
            id: 'shift-1',
            openedAt: '2026-02-12T08:00:00.000Z',
            cashierName: 'Кассир Айбек',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('/customers/summary')) {
        return new Response(JSON.stringify(mockSummary), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/credit-sales/sale-101/repayments')) {
        if (init?.method === 'POST') {
          return new Response(JSON.stringify({ debtMinor: 100000 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(mockRepayments), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/pos/credit-sales?customerId=')) {
        return new Response(JSON.stringify(customSales), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/invite/reset')) {
        return new Response(
          JSON.stringify({
            token: validToken,
            expiresAt: '2026-02-12T15:00:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes('/invite')) {
        return new Response(
          JSON.stringify({
            token: validToken,
            expiresAt: '2026-02-12T15:00:00.000Z',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.includes(`/shops/${shopId}/customers`)) {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 'c-new',
              name: 'Канат Салиев',
            }),
            { status: 201, headers: { 'content-type': 'application/json' } },
          );
        }
        return new Response(
          JSON.stringify({
            items: mockCustomers,
            total: mockCustomers.length,
            page: 1,
            pageSize: 10,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );
}

function renderComponent(initialRoute = `/seller/${shopId}/customers`) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          path="/seller/:shopId/customers"
          element={<ShopCustomersPage />}
        />
        <Route
          path="/seller/:shopId/debts"
          element={<ShopCustomersPage initialTab="debt" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

it('renders unified Customers and Debts hub with KPIs and customer rows', async () => {
  setupFetch();
  renderComponent();

  // Unified heading
  expect(
    await screen.findByRole('heading', { name: 'Клиенты и долги' }),
  ).toBeTruthy();

  // Metrics
  expect(screen.getByText('Общий долг магазину')).toBeTruthy();
  expect(screen.getByText('1 500,00 сом')).toBeTruthy();
  expect(screen.getByText('Должники')).toBeTruthy();

  // Table items
  expect(await screen.findByText('Азамат Исаев')).toBeTruthy();
  expect(screen.getByText('+996700111222')).toBeTruthy();
  expect(screen.getByText('★ 50 б.')).toBeTruthy();
  expect(screen.getByText('Бегимай Осмонова')).toBeTruthy();

  // Filter tabs
  expect(screen.getByRole('tab', { name: /С долгом/ })).toBeTruthy();
  expect(screen.getByRole('tab', { name: /Личный кабинет/ })).toBeTruthy();
});

it('opens debt repayment drawer and accepts repayment with shift and idempotency', async () => {
  const user = userEvent.setup();
  setupFetch();
  renderComponent();

  // Click "Погасить долг" on Azamat
  const repayBtn = await screen.findByRole('button', { name: 'Погасить долг' });
  await user.click(repayBtn);

  // Drawer displays
  expect(await screen.findByText('Взаиморасчёты с клиентом')).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Принять погашение в кассу' }),
  ).toBeTruthy();

  // Check quick chips
  const fullChip = screen.getByRole('button', { name: /Весь остаток/ });
  await user.click(fullChip);

  // Submit payment
  const submitBtn = screen.getByRole('button', { name: 'Принять погашение' });
  await user.click(submitBtn);

  // Expect success notice
  expect(
    await screen.findByText(/Платёж принят! Остаток по продаже: 1 000,00 сом/),
  ).toBeTruthy();
});

it('handles initialTab=debt when navigated to /debts', async () => {
  setupFetch();
  renderComponent(`/seller/${shopId}/debts`);

  expect(
    await screen.findByRole('heading', { name: 'Клиенты и долги' }),
  ).toBeTruthy();
  const debtTab = screen.getByRole('tab', { name: /С долгом/ });
  expect(debtTab.getAttribute('aria-selected')).toBe('true');
});

it('opens Add Customer modal and creates customer with QR invitation', async () => {
  const user = userEvent.setup();
  setupFetch();
  renderComponent();

  const addBtn = await screen.findByRole('button', { name: '+ Новый клиент' });
  await user.click(addBtn);

  expect(
    await screen.findByRole('heading', { name: 'Добавить нового клиента' }),
  ).toBeTruthy();

  const nameInput = screen.getByPlaceholderText('Например, Азамат');
  const phoneInput = screen.getByPlaceholderText('+996 700 123 456');

  await user.type(nameInput, 'Канат Салиев');
  await user.type(phoneInput, '+996700999888');

  const saveBtn = screen.getByRole('button', { name: 'Добавить и выдать QR' });
  await user.click(saveBtn);

  // QR invitation modal opens
  expect(await screen.findByText(/Приглашение для/)).toBeTruthy();
});

it('triggers password reset QR for verified buyer', async () => {
  const user = userEvent.setup();
  setupFetch();
  renderComponent();

  const resetBtn = await screen.findByRole('button', {
    name: 'Сбросить пароль (QR)',
  });
  await user.click(resetBtn);

  expect(await screen.findByText(/Приглашение для Азамат Исаев/)).toBeTruthy();
});
