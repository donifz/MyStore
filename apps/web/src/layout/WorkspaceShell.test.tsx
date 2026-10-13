import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { SessionProvider } from '../auth/SessionProvider';
import WorkspaceShell from './WorkspaceShell';
import type { Me } from '../api/types';
const owner = { id: 'own', name: 'Мой магазин', role: 'owner' as const };
const base: Me = {
  userId: 'u',
  email: 'admin@test.tld',
  csrfToken: 'c',
  platformAdmin: true,
  shops: [owner],
};
function Location() {
  const l = useLocation();
  return <output aria-label="Адрес">{l.pathname + l.search}</output>;
}
function open(user: Me, path = '/platform/admin', badLogout = false) {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify(
          url.endsWith('/logout') ? { message: 'Logout failed' } : user,
        ),
        { status: badLogout && url.endsWith('/logout') ? 500 : 200 },
      ),
  );
  render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <WorkspaceShell>
          <h1>Содержимое</h1>
        </WorkspaceShell>
        <Location />
      </SessionProvider>
    </MemoryRouter>,
  );
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});
it('keeps one account and brand while switching between platform and owned shop', async () => {
  open(base);
  const select = await screen.findByRole('combobox', {
    name: 'Рабочий контекст',
  });
  expect(screen.getAllByText('Рабочий кабинет')).toHaveLength(1);
  expect(screen.getAllByText('admin@test.tld')).toHaveLength(1);
  expect(screen.getByText('Администратор платформы')).toBeTruthy();
  await userEvent.setup().selectOptions(select, 'shop:own');
  expect(screen.getByLabelText('Адрес').textContent).toBe(
    '/seller/own/products',
  );
  expect(screen.getByText('Владелец')).toBeTruthy();
  expect(screen.getAllByText('admin@test.tld')).toHaveLength(1);
  expect(
    screen.getByRole('link', { name: 'Товары', current: 'page' }),
  ).toBeTruthy();
  await userEvent.setup().selectOptions(select, 'platform');
  expect(screen.getByLabelText('Адрес').textContent).toBe('/platform/admin');
});
it('shows only granted contexts and routes into a mixed-role cashier shop correctly', async () => {
  open(
    {
      ...base,
      platformAdmin: false,
      shops: [owner, { ...owner, id: 'cash', name: 'Касса', role: 'cashier' }],
    },
    '/seller/own/products',
  );
  const select = await screen.findByRole('combobox', {
    name: 'Рабочий контекст',
  });
  expect(screen.queryByRole('option', { name: 'Платформа' })).toBeNull();
  await userEvent.setup().selectOptions(select, 'shop:cash');
  expect(screen.getByLabelText('Адрес').textContent).toBe('/seller/cash/pos');
  expect(screen.queryByRole('link', { name: 'Сотрудники' })).toBeNull();
  expect(screen.getByText('Кассир')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Касса', current: 'page' }),
  ).toBeTruthy();
});
it('does not render protected content for a forbidden route and exposes a way out', async () => {
  open({ ...base, platformAdmin: false }, '/platform/admin');
  await screen.findByRole('alert');
  expect(screen.queryByRole('heading', { name: 'Содержимое' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy();
});
it('handles empty membership, long names as text, and logout errors', async () => {
  open(
    { ...base, platformAdmin: false, shops: [] },
    '/seller?view=shops',
    true,
  );
  await screen.findByRole('combobox', { name: 'Рабочий контекст' });
  await userEvent.setup().click(screen.getByRole('button', { name: 'Выйти' }));
  await screen.findByRole('alert');
  expect(
    screen
      .getByRole('combobox', { name: 'Рабочий контекст' })
      .hasAttribute('disabled'),
  ).toBe(true);
});
