import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TelegramOwnerSettings from './TelegramOwnerSettings';

const shopId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders unconnected state and allows generating Telegram connection link', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', async (url: string, opts?: any) => {
    if (url.endsWith('/telegram/status')) {
      return new Response(
        JSON.stringify({
          enabled: true,
          botUsername: 'mystore_bot',
          subscription: null,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    if (url.endsWith('/telegram/link-token') && opts?.method === 'POST') {
      return new Response(
        JSON.stringify({
          url: 'https://t.me/mystore_bot?start=owner_sampletoken123456789012345678',
          expiresIn: 900,
        }),
        {
          status: 201,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    return new Response(null, { status: 404 });
  });

  render(<TelegramOwnerSettings shopId={shopId} owner={true} />);

  expect(
    await screen.findByText('Telegram-сводка для владельца (Закрытие смены)'),
  ).toBeTruthy();

  const connectBtn = screen.getByRole('button', {
    name: /Подключить Telegram/i,
  });
  expect(connectBtn).toBeTruthy();

  await user.click(connectBtn);

  expect(
    await screen.findByText(/Открыть Telegram-бота \(@mystore_bot\)/i),
  ).toBeTruthy();
});

it('renders connected state and allows triggering test summary', async () => {
  const user = userEvent.setup();
  let testCalled = false;

  vi.stubGlobal('fetch', async (url: string, opts?: any) => {
    if (url.endsWith('/telegram/status')) {
      return new Response(
        JSON.stringify({
          enabled: true,
          botUsername: 'mystore_bot',
          subscription: {
            chatId: '987654321',
            username: 'boss_user',
            firstName: 'Boss',
            dailyShiftSummary: true,
            createdAt: '2026-11-13T00:00:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }
    if (url.endsWith('/telegram/test-summary') && opts?.method === 'POST') {
      testCalled = true;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response(null, { status: 404 });
  });

  render(<TelegramOwnerSettings shopId={shopId} owner={true} />);

  expect(await screen.findByText(/Подключено к Telegram/i)).toBeTruthy();
  expect(screen.getByText(/@boss_user/i)).toBeTruthy();

  const testBtn = screen.getByRole('button', { name: /Отправить тест/i });
  await user.click(testBtn);

  expect(testCalled).toBe(true);
  expect(
    await screen.findByText(/Тестовая сводка успешно отправлена/i),
  ).toBeTruthy();
});
