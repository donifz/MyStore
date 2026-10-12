import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { SessionProvider } from '../auth/SessionProvider';
import StaffPage from './StaffPage';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('invites only manager/cashier and retains the operation key after a lost response', async () => {
  const requests: any[] = [];
  let attempt = 0;
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/auth/me')
      return new Response(
        JSON.stringify({
          userId: 'owner',
          email: 'owner@example.test',
          shops: [{ id: 'shop', name: 'Test', role: 'owner' }],
          csrfToken: 'csrf',
        }),
      );
    if (url.endsWith('/invitations')) {
      requests.push(options);
      attempt++;
      if (attempt === 1) throw new TypeError('offline');
      return new Response(JSON.stringify({ id: 'invite' }), { status: 201 });
    }
    if (url.endsWith('/email/status'))
      return new Response(
        JSON.stringify({ enabled: false, configured: false, deliveries: [] }),
      );
    return new Response(JSON.stringify({ members: [], invitations: [] }));
  });
  render(
    <MemoryRouter initialEntries={['/seller/shop/staff']}>
      <SessionProvider>
        <Routes>
          <Route path="/seller/:shopId/staff" element={<StaffPage />} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
  await screen.findByLabelText('Email сотрудника');
  expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
    'Менеджер',
    'Кассир',
  ]);
  fireEvent.change(screen.getByLabelText('Email сотрудника'), {
    target: { value: 'new@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Пригласить' }));
  await screen.findByRole('button', { name: 'Повторить операцию' });
  fireEvent.click(screen.getByRole('button', { name: 'Повторить операцию' }));
  await waitFor(() => expect(requests).toHaveLength(2));
  expect((requests[0].headers as any)['idempotency-key']).toBe(
    (requests[1].headers as any)['idempotency-key'],
  );
  expect(requests[0].body).toBe(requests[1].body);
});
