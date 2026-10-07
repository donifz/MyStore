import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BarcodeLabel from './BarcodeLabel';

const product = {
  id: 'variant-1',
  name: 'Наушники белые',
  barcode: 'MS0123456789ABCDEF01234567',
  sku: 'MS-0123456789AB',
  salePriceMinor: 125000,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('renders a Code 128 barcode and the product details before printing', () => {
  render(<BarcodeLabel product={product} />);

  expect(screen.getByText('Наушники белые')).toBeTruthy();
  expect(screen.getByText('MS0123456789ABCDEF01234567')).toBeTruthy();
  expect(
    screen.getByText((_, node) => node?.textContent === '1 250,00 сом'),
  ).toBeTruthy();
  expect(document.querySelector('svg[aria-label="Штрихкод"]')).toBeTruthy();
});

it('opens the browser print dialog when asked to print a label', async () => {
  const print = vi.spyOn(window, 'print').mockImplementation(() => {});
  const user = userEvent.setup();
  render(<BarcodeLabel product={product} />);

  await user.click(screen.getByRole('button', { name: 'Печать этикетки' }));

  expect(print).toHaveBeenCalledOnce();
});
