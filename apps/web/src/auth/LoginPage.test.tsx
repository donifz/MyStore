import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('shows safe login error without keeping authentication token', async () => {
  vi.stubGlobal(
    'fetch',
    async (url: string) =>
      new Response(
        JSON.stringify({
          message: url.endsWith('/me') ? 'Unauthorized' : 'Invalid credentials',
        }),
        { status: 401, headers: { 'content-type': 'application/json' } },
      ),
  );
  const app = await import('../App').catch(() => null);
  expect(app, 'seller app must exist').not.toBeNull();
  if (!app) return;
  render(
    <MemoryRouter initialEntries={['/seller/login']}>
      <app.default />
    </MemoryRouter>,
  );
  await screen.findByLabelText('Email');
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'owner@example.test');
  await user.type(screen.getByLabelText('Пароль'), 'wrong-password');
  await user.click(screen.getByRole('button', { name: 'Войти' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Проверьте email и пароль',
  );
  expect(localStorage.getItem('token')).toBeNull();
});
