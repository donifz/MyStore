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
            hasOwner: true,
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

it('does not offer a password reset for a shop without an owner', async () => {
  const requests: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    requests.push(url);
    const body =
      url === '/api/auth/me'
        ? {
            userId: 'admin',
            email: 'admin@example.test',
            csrfToken: 'csrf',
            platformAdmin: true,
            shops: [],
          }
        : url === '/api/platform/admin/overview'
          ? {
              shopCount: 1,
              pendingPartners: 0,
              pendingProducts: 0,
              shops: [{ id: 'shop-1', name: 'Новый магазин', hasOwner: false }],
            }
          : { items: [], total: 0 };
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

  expect(
    await screen.findByText('У магазина нет назначенного владельца'),
  ).not.toBeNull();
  expect(
    screen.getByRole('button', { name: 'Сбросить пароль владельца' }),
  ).toHaveProperty('disabled', true);
  expect(requests.some((url) => url.endsWith('/reset-owner-password'))).toBe(
    false,
  );
});

it('explains when the shop owner disappears before the reset request', async () => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/reset-owner-password'))
      return new Response(JSON.stringify({ message: 'Shop owner not found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    const body =
      url === '/api/auth/me'
        ? {
            userId: 'admin',
            email: 'admin@example.test',
            csrfToken: 'csrf',
            platformAdmin: true,
            shops: [],
          }
        : url === '/api/platform/admin/overview'
          ? {
              shopCount: 1,
              pendingPartners: 0,
              pendingProducts: 0,
              shops: [{ id: 'shop-1', name: 'Магазин у дома', hasOwner: true }],
            }
          : { items: [], total: 0 };
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

  await userEvent
    .setup()
    .click(
      await screen.findByRole('button', { name: 'Сбросить пароль владельца' }),
    );
  expect(
    await screen.findByText(
      'У магазина «Магазин у дома» нет назначенного владельца. Сбросить пароль некому.',
    ),
  ).not.toBeNull();
});
