import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DirectStaffForm from './DirectStaffForm';
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('retries lost direct creation with the same payload and reveals the recovered initial password', async () => {
  const requests: RequestInit[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options);
    if (requests.length === 1) throw new TypeError('lost response');
    return new Response(
      JSON.stringify({
        email: 'new@example.test',
        temporaryPassword: 'initial-test-password',
        existingAccount: false,
      }),
      { status: 201 },
    );
  });
  const onCreated = vi.fn(async () => {}),
    onLock = vi.fn();
  render(
    <DirectStaffForm
      base="/shops/shop/staff"
      disabled={false}
      onCreated={onCreated}
      onLock={onLock}
    />,
  );
  fireEvent.change(screen.getByLabelText('Email нового сотрудника'), {
    target: { value: 'new@example.test' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Создать сотрудника' }));
  await screen.findByRole('button', { name: 'Повторить создание сотрудника' });
  expect(
    (
      screen
        .getByLabelText('Email нового сотрудника')
        .closest('fieldset') as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  fireEvent.click(
    screen.getByRole('button', { name: 'Повторить создание сотрудника' }),
  );
  await screen.findByText('initial-test-password');
  expect(requests).toHaveLength(2);
  expect(new Headers(requests[0].headers).get('idempotency-key')).toBe(
    new Headers(requests[1].headers).get('idempotency-key'),
  );
  expect(requests[0].body).toBe(requests[1].body);
  expect(onCreated).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
  expect(screen.queryByText('initial-test-password')).toBeNull();
});
