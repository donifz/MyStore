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

it('defaults to a 30 × 20 mm label, lets the user choose 58 × 40 mm and keeps the printed code next to the bars', async () => {
  const user = userEvent.setup();
  const { container } = render(<BarcodeLabel product={product} />);

  expect(container.querySelector('.barcode-label--30x20')).toBeTruthy();
  expect(container.querySelector('style')?.textContent).toContain(
    'size: 30mm 20mm',
  );
  expect(container.querySelector('.barcode-mark .barcode-value')).toBeTruthy();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Размер этикетки' }),
    '58x40',
  );

  expect(container.querySelector('.barcode-label--58x40')).toBeTruthy();
  expect(container.querySelector('style')?.textContent).toContain(
    'size: 58mm 40mm',
  );
});
