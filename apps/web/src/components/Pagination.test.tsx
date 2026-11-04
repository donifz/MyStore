import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Pagination from './Pagination';
import { paginationItems } from './Pagination';

describe('paginationItems', () => {
  it('shows the first five pages, a gap and the end on long lists', () => {
    expect(paginationItems(1, 20)).toEqual([1, 2, 3, 4, 5, '…', 20]);
  });

  it('keeps first, current and last pages visible in the middle', () => {
    expect(paginationItems(10, 20)).toEqual([
      1,
      '…',
      8,
      9,
      10,
      11,
      12,
      '…',
      20,
    ]);
  });

  it('shows a contiguous final window and no duplicate final page', () => {
    expect(paginationItems(20, 20)).toEqual([1, '…', 16, 17, 18, 19, 20]);
  });

  it('clamps out-of-range pages and handles empty totals', () => {
    expect(paginationItems(99, 3)).toEqual([1, 2, 3]);
    expect(paginationItems(1, 0)).toEqual([1]);
  });
});

it('keeps going back possible when the current page no longer exists', async () => {
  const onPage = vi.fn();
  render(<Pagination page={2} total={24} size={24} onPage={onPage} />);
  const back = screen.getByRole('button', { name: 'Назад' });
  expect(back.hasAttribute('disabled')).toBe(false);
  await userEvent.setup().click(back);
  expect(onPage).toHaveBeenCalledWith(1);
});
