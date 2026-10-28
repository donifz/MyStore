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

it('issues the first password for a shop without an owner', async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    requests.push({ url, init });
    if (url.endsWith('/reset-owner-password'))
      return new Response(
        JSON.stringify({
          email: 'new-owner@example.test',
          temporaryPassword: 'first-password-value',
        }),
        { headers: { 'content-type': 'application/json' } },
      );
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
              shops: [
                {
                  id: 'shop-1',
                  name: 'Новый магазин',
                  hasOwner: false,
                  ownerCandidateEmail: 'new-owner@example.test',
                },
              ],
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

  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Выдать первый пароль владельцу',
    }),
  );
  expect(
    screen.getByRole('textbox', { name: 'Email владельца' }),
  ).toHaveProperty('value', 'new-owner@example.test');
  await userEvent
    .setup()
    .click(
      screen.getByRole('button', { name: 'Создать владельца и выдать пароль' }),
    );
  expect(
    await screen.findByRole('textbox', { name: 'Новый пароль владельца' }),
  ).toHaveProperty('value', 'first-password-value');
  expect(
    requests.some(
      ({ url, init }) =>
        url === '/api/platform/admin/shops/shop-1/reset-owner-password' &&
        init?.method === 'POST' &&
        JSON.parse(String(init.body)).ownerEmail === 'new-owner@example.test',
    ),
  ).toBe(true);
});

it('explains a conflicting email when creating a shop owner', async () => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  vi.stubGlobal('fetch', async (url: string) => {
    if (url.endsWith('/reset-owner-password'))
      return new Response(
        JSON.stringify({
          message: 'An account with this email already exists',
        }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      );
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
              shops: [
                {
                  id: 'shop-1',
                  name: 'Магазин у дома',
                  hasOwner: false,
                  ownerCandidateEmail: 'owner@example.test',
                },
              ],
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

  await userEvent.setup().click(
    await screen.findByRole('button', {
      name: 'Выдать первый пароль владельцу',
    }),
  );
  await userEvent
    .setup()
    .click(
      screen.getByRole('button', { name: 'Создать владельца и выдать пароль' }),
    );
  expect(
    await screen.findByText(
      'Учётная запись с этим email уже существует. Проверьте владельца магазина.',
    ),
  ).not.toBeNull();
});
