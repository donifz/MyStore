import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders closed shift state with previous shift results and owner Telegram settings', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    let body: any = {};
    if (url.includes('/auth/me')) {
      body = {
        userId: 'owner-id',
        email: 'owner@example.test',
        csrfToken: 'csrf',
        shops: [{ id: shopId, name: 'Мой Магазин', role: 'owner' }],
      };
    } else if (
      url.includes('/pos/shifts/active') ||
      url.includes('/pos/shifts/current')
    ) {
      body = null;
    } else if (url.includes('/pos/shifts/latest')) {
      body = {
        id: 'shift-prev-1',
        shopId,
        actorId: 'owner-id',
        status: 'closed',
        openingCashMinor: 100000,
        expectedCashMinor: 250000,
        actualCashMinor: 250000,
        discrepancyMinor: 0,
        salesCashMinor: 150000,
        salesCardMinor: 80000,
        repaymentsCashMinor: 0,
        repaymentsCardMinor: 0,
        refundsCashMinor: 0,
        refundsCardMinor: 0,
        cashInMinor: 0,
        cashOutMinor: 0,
        comment: 'Всё сошлось',
        openedAt: '2026-11-12T08:00:00.000Z',
        closedAt: '2026-11-12T20:00:00.000Z',
      };
    } else if (url.includes('/telegram/status')) {
      body = {
        enabled: true,
        botUsername: 'mystore_bot',
        subscription: {
          chatId: '123456789',
          telegramUserId: '123456789',
          username: 'storeowner',
          firstName: 'Владелец',
          dailyShiftSummary: true,
          createdAt: '2026-11-12T10:00:00.000Z',
        },
      };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={[`/seller/${shopId}/shift`]}>
      <App />
    </MemoryRouter>,
  );

  // Header and status
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Смена' }),
  ).toBeTruthy();
  expect(await screen.findByText('Смена закрыта')).toBeTruthy();

  // Previous shift results card
  expect(await screen.findByText('Итоги последней смены')).toBeTruthy();
  expect(await screen.findByText('Сходится (0 сом)')).toBeTruthy();

  // Open shift form with auto-filled opening cash (250000 minor = 2500)
  expect(
    await screen.findByRole('heading', { level: 2, name: 'Открыть смену' }),
  ).toBeTruthy();
  expect(await screen.findByDisplayValue('2500')).toBeTruthy();

  // Telegram owner settings block is prominently rendered
  expect(
    await screen.findByText(/Telegram-сводка для владельца/i),
  ).toBeTruthy();
  expect(await screen.findByText(/Подключено к Telegram/i)).toBeTruthy();
  expect(
    await screen.findByRole('button', {
      name: /Отправить тест/i,
    }),
  ).toBeTruthy();
});

it('renders open shift with KPI cards, cash action buttons, and closing form', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    let body: any = {};
    if (url.includes('/auth/me')) {
      body = {
        userId: 'owner-id',
        email: 'owner@example.test',
        csrfToken: 'csrf',
        shops: [{ id: shopId, name: 'Мой Магазин', role: 'owner' }],
      };
    } else if (
      url.includes('/pos/shifts/active') ||
      url.includes('/pos/shifts/current')
    ) {
      body = {
        id: 'shift-active-1',
        shopId,
        actorId: 'owner-id',
        status: 'open',
        openingCashMinor: 200000,
        expectedCashMinor: 550000,
        actualCashMinor: null,
        discrepancyMinor: null,
        salesCashMinor: 350000,
        salesCardMinor: 150000,
        repaymentsCashMinor: 0,
        repaymentsCardMinor: 0,
        refundsCashMinor: 0,
        refundsCardMinor: 0,
        cashInMinor: 0,
        cashOutMinor: 0,
        comment: null,
        openedAt: '2026-11-13T08:00:00.000Z',
        closedAt: null,
      };
    } else if (url.includes('/pos/shifts/shift-active-1/transactions')) {
      body = [];
    } else if (url.includes('/telegram/status')) {
      body = {
        enabled: true,
        botUsername: 'mystore_bot',
        subscription: null,
      };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={[`/seller/${shopId}/shift`]}>
      <App />
    </MemoryRouter>,
  );

  // Revenue KPI
  expect(await screen.findByText(/Выручка за смену/i)).toBeTruthy();
  expect(await screen.findByText(/В кассе \(наличные\)/i)).toBeTruthy();

  // Fast cash actions
  expect(
    await screen.findByRole('button', { name: /\+ Внесение наличных/i }),
  ).toBeTruthy();
  expect(
    await screen.findByRole('button', { name: /− Изъятие \/ Расход/i }),
  ).toBeTruthy();

  // Closing section and detailed expenses button
  expect(
    await screen.findByRole('heading', { level: 3, name: 'Закрытие смены' }),
  ).toBeTruthy();
  expect(
    await screen.findByRole('button', { name: /Детальный расход кассы/i }),
  ).toBeTruthy();
  expect(
    await screen.findByRole('button', { name: 'Закрыть смену' }),
  ).toBeTruthy();

  // Telegram owner settings with connect button visible even while open
  expect(
    await screen.findByText(/Telegram-сводка для владельца/i),
  ).toBeTruthy();
  expect(
    await screen.findByRole('button', { name: /Подключить Telegram/i }),
  ).toBeTruthy();
});
