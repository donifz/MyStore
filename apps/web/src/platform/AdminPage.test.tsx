import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SessionProvider } from '../auth/SessionProvider';
import AdminPage from './AdminPage';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('resets a registered shop owner password and shows it once to the admin', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    let body: unknown;
    if (url === '/api/auth/me') {
      body = {
        userId: 'admin',
        email: 'admin@example.test',
        csrfToken: 'csrf',
        platformAdmin: true,
        shops: [],
      };
    } else if (url === '/api/platform/admin/overview') {
      body = {
        shopCount: 1,
        pendingPartners: 0,
        pendingProducts: 0,
        shops: [
          {
            id: 'shop-1',
            name: 'Магазин у дома',
            city: 'Ош',
            published: true,
          },
        ],
      };
    } else if (url.endsWith('/reset-owner-password')) {
      body = {
        email: 'owner@example.test',
        temporaryPassword: 'a-generated-password-value',
      };
    } else {
      body = { items: [], total: 0 };
    }
    return new Response(JSON.stringify(body), {
      headers: { 'content-type': 'application/json' },
    });
  });

  render(
    <MemoryRouter initialEntries={['/platform/admin']}>
      <SessionProvider>
        <AdminPage />
      </SessionProvider>
    </MemoryRouter>,
  );

  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Сбросить пароль владельца',
    }),
  );
  expect(window.confirm).toHaveBeenCalledWith(
    'Сбросить пароль владельца магазина «Магазин у дома»? Текущий пароль перестанет работать.',
  );
  expect(
    await screen.findByRole('textbox', { name: 'Новый пароль владельца' }),
  ).toHaveProperty('value', 'a-generated-password-value');
  expect(
    requests.some(
      ({ url, init }) =>
        url === '/api/platform/admin/shops/shop-1/reset-owner-password' &&
        init?.method === 'POST',
    ),
  ).toBe(true);
});
