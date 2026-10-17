import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';

const shopId = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('renders human-readable audit log with categories, badges, and search filtering', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const body = url.endsWith('/me')
      ? {
          userId: 'owner-id',
          email: 'owner@example.test',
          csrfToken: 'csrf',
          shops: [{ id: shopId, name: 'Магазин у дома', role: 'owner' }],
        }
      : url.includes('/notifications')
        ? [
            {
              id: 'notif-1',
              kind: 'order_created',
              title: 'Новый заказ',
              body: 'Поступил заказ № 1234',
              entityId: 'order-1',
              createdAt: '2026-10-17T10:00:00.000Z',
              readAt: null,
            },
          ]
        : url.includes('/audit')
          ? [
              {
                id: 1,
                actorId: 'owner-id',
                action: 'insert',
                entityType: 'stock_document',
                entityId: 'doc-1',
                details: {
                  kind: 'sale',
                  number: 'ЧЕК-001',
                  lines_count: 2,
                },
                createdAt: '2026-10-17T11:00:00.000Z',
              },
              {
                id: 2,
                actorId: 'owner-id',
                action: 'status_change',
                entityType: 'order',
                entityId: 'order-11112222',
                details: {
                  from: 'new',
                  to: 'confirmed',
                },
                createdAt: '2026-10-17T11:05:00.000Z',
              },
              {
                id: 3,
                actorId: 'owner-id',
                action: 'staff:permissions',
                entityType: 'staff',
                entityId: 'user-2',
                details: {
                  canReturn: true,
                  canViewReports: false,
                },
                createdAt: '2026-10-17T11:10:00.000Z',
              },
            ]
          : url.includes('/email/preferences')
            ? { orders: true, moderation: true }
            : url.includes('/email/status')
              ? {
                  configured: false,
                  enabled: false,
                  provider: 'smtp',
                  deliveries: [],
                }
              : {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={[`/seller/${shopId}/operations`]}>
      <App />
    </MemoryRouter>,
  );

  // Notifications
  expect(await screen.findByText('Новый заказ')).toBeTruthy();

  // Audit items
  expect(await screen.findByText('Журнал аудита')).toBeTruthy();
  expect(await screen.findByText('Продажа на кассе')).toBeTruthy();
  expect(screen.getByText('Смена статуса онлайн-заказа')).toBeTruthy();
  expect(screen.getByText('Настройка прав сотрудника')).toBeTruthy();
  expect(screen.getByText('ЧЕК-001')).toBeTruthy();
  expect(screen.getByText('Новый → Подтверждён')).toBeTruthy();

  // Search filter
  const searchInput = screen.getByLabelText('Поиск по журналу аудита');
  const user = userEvent.setup();
  await user.type(searchInput, 'кассе');
  expect(screen.getByText('Продажа на кассе')).toBeTruthy();
  expect(screen.queryByText('Смена статуса онлайн-заказа')).toBeNull();

  // Clear search and test category filter
  await user.clear(searchInput);
  const ordersCategoryBtn = screen.getByRole('button', { name: 'Заказы' });
  await user.click(ordersCategoryBtn);
  expect(screen.getByText('Смена статуса онлайн-заказа')).toBeTruthy();
  expect(screen.queryByText('Продажа на кассе')).toBeNull();

  // Test Raw JSON toggle
  const jsonToggle = screen.getByLabelText('Сырые данные (JSON)');
  await user.click(jsonToggle);
  expect(screen.getByText('JSON')).toBeTruthy();
});
