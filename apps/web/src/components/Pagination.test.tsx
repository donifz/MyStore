import { describe, expect, it } from 'vitest';
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
