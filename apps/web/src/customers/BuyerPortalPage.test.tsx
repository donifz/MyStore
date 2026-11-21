import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import BuyerPortalPage from './BuyerPortalPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const mockAccount = {
  id: 'buyer-1',
  phone: '+996700123456',
  name: 'Дооронбек',
  phoneVerified: true,
  shops: [{ shopId: 'shop-1', shopName: 'ТехноМир' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  csrfToken: 'csrf-123',
};

const mockDebts = [
  {
    saleId: 'sale-1',
    shopId: 'shop-1',
    shopName: 'ТехноМир',
    totalMinor: 250000,
    paidMinor: 130000,
    debtMinor: 120000,
    dueOn: '2026-11-24T00:00:00.000Z',
  },
];

const mockRepayments = [
  {
    id: 'rep-1',
    saleId: 'sale-1',
    shopId: 'shop-1',
    shopName: 'ТехноМир',
    amountMinor: 130000,
    method: 'card' as const,
    createdAt: '2026-02-01T12:00:00.000Z',
  },
];

const mockWallets = [
  { shopId: 'shop-1', shopName: 'ТехноМир', balancePoints: 850 },
];

it('renders auth form when user is not signed in', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      });
    }),
  );

  render(
    <MemoryRouter>
      <BuyerPortalPage />
    </MemoryRouter>,
  );

  expect(
    await screen.findByRole('heading', { name: 'Создать аккаунт' }),
  ).toBeTruthy();
  expect(screen.getByLabelText('Ваше имя')).toBeTruthy();
  expect(screen.getByLabelText('Номер телефона')).toBeTruthy();
  expect(screen.getByLabelText('Пароль')).toBeTruthy();

  fireEvent.click(
    screen.getByRole('button', { name: 'Уже есть аккаунт? Войти' }),
  );
  expect(
    await screen.findByRole('heading', { name: 'Войти в кабинет' }),
  ).toBeTruthy();
  expect(screen.queryByLabelText('Ваше имя')).toBeNull();
});

it('renders authenticated dashboard with embedded QR card, debts and repayments', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/me')) {
        return new Response(JSON.stringify(mockAccount), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/debts')) {
        return new Response(JSON.stringify(mockDebts), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/repayments')) {
        return new Response(JSON.stringify(mockRepayments), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/loyalty/config')) {
        return new Response(JSON.stringify({ enabled: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/loyalty/wallets')) {
        return new Response(JSON.stringify(mockWallets), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/telegram/config')) {
        return new Response(JSON.stringify({ enabled: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/loyalty/qr')) {
        return new Response(
          JSON.stringify({ token: 'test-qr-token-12345678' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' },
          },
        );
      }
      return new Response('{}', { status: 200 });
    }),
  );

  render(
    <MemoryRouter>
      <BuyerPortalPage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Здравствуйте, Дооронбек!')).toBeTruthy();
  expect(screen.getByText('Телефон подтверждён')).toBeTruthy();
  expect(screen.getByText('+996 700 123 456')).toBeTruthy();
  expect(await screen.findByText('850 баллов')).toBeTruthy();
  expect(await screen.findAllByText('ТехноМир')).toHaveLength(3);
  expect(screen.getAllByText('1 200,00 сом')).toHaveLength(3);
  expect(screen.getByText('Погасить до: 24.11.2026')).toBeTruthy();
  expect(screen.queryByText('MYSTORE CLUB')).toBeNull();
  expect(screen.queryByText('Подключено магазинов')).toBeNull();
  expect(screen.queryByText('Д')).toBeNull();
  expect(
    screen.getByRole('navigation', { name: 'Разделы витрины' }),
  ).toBeTruthy();
  expect(
    screen.getAllByRole('link', { name: 'Главная' })[0].getAttribute('href'),
  ).toBe('/');
  expect(
    screen
      .getAllByRole('link', { name: 'Профиль' })[0]
      .getAttribute('aria-current'),
  ).toBe('page');

  // Verify that the QR code is embedded directly into the card without clicking
  expect(await screen.findByText(/Действует:/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /Обновить QR/ })).toBeTruthy();

  // Test Refresh QR button
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Обновить QR/ }));
  expect(await screen.findByText(/Действует:/)).toBeTruthy();
});

it('keeps generated initial password hidden until buyer clicks reveal button', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/me')) {
        return new Response(
          JSON.stringify({ ...mockAccount, hasInitialPassword: true }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/initial-password')) {
        return new Response(JSON.stringify({ password: 'Ab3dEf7gHj9K' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/debts') || url.endsWith('/repayments')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/telegram/config') || url.endsWith('/loyalty/config')) {
        return new Response(JSON.stringify({ enabled: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );

  render(
    <MemoryRouter>
      <BuyerPortalPage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Пароль для входа')).toBeTruthy();
  const pwBox = screen.getByTestId('buyer-initial-password');
  expect(pwBox.textContent).toBe('••••••••••••');

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Показать пароль' }));
  expect(await screen.findByText('Ab3dEf7gHj9K')).toBeTruthy();

  await user.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
  expect(screen.getByTestId('buyer-initial-password').textContent).toBe(
    '••••••••••••',
  );
});

it('displays buyer in-store purchases with items and bonus points', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/me')) {
        return new Response(JSON.stringify(mockAccount), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/loyalty/purchases')) {
        return new Response(
          JSON.stringify([
            {
              saleId: 'abcd1234-1111-4111-8111-111111111111',
              shopId: 'shop-1',
              shopName: 'Юный инженер',
              totalMinor: 120000,
              createdAt: '2026-11-21T10:00:00.000Z',
              method: 'card',
              isCredit: false,
              earnedPoints: 12,
              spentPoints: 0,
              lines: [
                {
                  name: 'Конструктор',
                  quantity: 2,
                  unitPriceMinor: 60000,
                  discountMinor: 0,
                },
              ],
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith('/debts') || url.endsWith('/repayments')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith('/telegram/config') || url.endsWith('/loyalty/config')) {
        return new Response(JSON.stringify({ enabled: false }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    }),
  );

  render(
    <MemoryRouter>
      <BuyerPortalPage />
    </MemoryRouter>,
  );

  expect(await screen.findByText('Мои покупки')).toBeTruthy();
  expect(await screen.findByText('Юный инженер')).toBeTruthy();
  expect(screen.getByText(/Конструктор × 2/)).toBeTruthy();
  expect(screen.getByText('+12 б.')).toBeTruthy();
});
