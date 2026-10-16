import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import OrderDeadline from './OrderDeadline';
afterEach(cleanup);
it('shows the deadline on the shop local date with an explicit timezone', () => {
  render(
    <OrderDeadline expiresAt="2026-10-17T20:00:00Z" timeZone="Asia/Bishkek" />,
  );
  expect(screen.getByText(/18\.10\.2026/)).toBeTruthy();
  expect(screen.getByText(/02:00/)).toBeTruthy();
  expect(screen.getByText(/Asia\/Bishkek/)).toBeTruthy();
});
it('does not imply a confirmation deadline after the reserve was cleared', () => {
  const { container } = render(
    <OrderDeadline expiresAt={null} timeZone="Asia/Bishkek" />,
  );
  expect(container.textContent).toBe('');
});
