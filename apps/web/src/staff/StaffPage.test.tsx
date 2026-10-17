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

it('saves independent permissions, preserves unknown results for retry, and displays server state', async () => {
  let permissions = { canReturn: false, canViewReports: false };
  let attempts = 0;
  const requests: RequestInit[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/auth/me')
      return new Response(
        JSON.stringify({
          userId: 'owner',
          shops: [{ id: 'shop', name: 'Test', role: 'owner' }],
        }),
      );
    if (url.endsWith('/email/status'))
      return new Response(JSON.stringify({ configured: false }));
    if (url.endsWith('/permissions')) {
      requests.push(options!);
      permissions = JSON.parse(options!.body as string);
      if (++attempts === 1) throw new TypeError('lost response');
      return new Response(JSON.stringify({ updated: true }), { status: 201 });
    }
    return new Response(
      JSON.stringify({
        members: [
          {
            id: 'employee',
            email: 'cashier@example.test',
            role: 'cashier',
            ...permissions,
          },
        ],
        invitations: [],
      }),
    );
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
  const returns = await screen.findByLabelText('Возвраты cashier@example.test');
  const reports = screen.getByLabelText(
    'Финансовые отчёты cashier@example.test',
  );
  expect((returns as HTMLInputElement).checked).toBe(false);
  fireEvent.click(returns);
  await screen.findByRole('button', { name: 'Повторить операцию' });
  expect((reports as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Повторить операцию' }));
  await waitFor(() =>
    expect(
      (
        screen.getByLabelText(
          'Возвраты cashier@example.test',
        ) as HTMLInputElement
      ).checked,
    ).toBe(true),
  );
  expect(requests[0].body).toBe(
    JSON.stringify({ canReturn: true, canViewReports: false }),
  );
  expect(requests[1].body).toBe(requests[0].body);
  expect((requests[1].headers as any)['idempotency-key']).toBe(
    (requests[0].headers as any)['idempotency-key'],
  );
  fireEvent.click(
    screen.getByLabelText('Финансовые отчёты cashier@example.test'),
  );
  await waitFor(() => expect(requests).toHaveLength(3));
  expect(JSON.parse(requests[2].body as string)).toEqual({
    canReturn: true,
    canViewReports: true,
  });
});

it.each([false, true])(
  'blocks writes until authoritative refresh succeeds, refresh failure=%s',
  async (failRefresh) => {
    let release!: (response: Response) => void;
    let loads = 0;
    const member = {
      id: 'employee',
      email: 'cashier@example.test',
      role: 'cashier',
      canReturn: true,
      canViewReports: true,
    };
    vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
      if (url === '/api/auth/me')
        return new Response(
          JSON.stringify({
            userId: 'owner',
            shops: [{ id: 'shop', name: 'Test', role: 'owner' }],
          }),
        );
      if (url.endsWith('/email/status'))
        return new Response(JSON.stringify({ configured: false }));
      if (url.endsWith('/permissions'))
        return new Response(JSON.stringify({ updated: true }), { status: 201 });
      if (++loads === 1)
        return new Response(
          JSON.stringify({ members: [member], invitations: [] }),
        );
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
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
    fireEvent.click(
      await screen.findByLabelText('Возвраты cashier@example.test'),
    );
    await waitFor(() => expect(loads).toBe(2));
    expect(
      (
        screen.getByLabelText(
          'Финансовые отчёты cashier@example.test',
        ) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    if (failRefresh) {
      release(
        new Response(JSON.stringify({ message: 'Unavailable' }), {
          status: 503,
        }),
      );
      await screen.findByRole('alert');
      expect(
        (
          screen.getByLabelText(
            'Финансовые отчёты cashier@example.test',
          ) as HTMLInputElement
        ).disabled,
      ).toBe(true);
      fireEvent.click(screen.getByRole('button', { name: 'Обновить список' }));
      await waitFor(() => expect(loads).toBe(3));
    }
    release(
      new Response(
        JSON.stringify({
          members: [{ ...member, canReturn: false }],
          invitations: [],
        }),
      ),
    );
    await waitFor(() =>
      expect(
        (
          screen.getByLabelText(
            'Финансовые отчёты cashier@example.test',
          ) as HTMLInputElement
        ).disabled,
      ).toBe(false),
    );
  },
);
