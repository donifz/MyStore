import { expect, it } from 'vitest';
import {
  allocateCheckoutDiscount,
  parseCheckoutDiscount,
} from './checkout-discount';

it('calculates a fixed or percentage discount in integer minor units', () => {
  expect(parseCheckoutDiscount('50', 'som', 80000)).toEqual({
    minor: 5000,
    error: '',
  });
  expect(parseCheckoutDiscount('10', 'percent', 80000)).toEqual({
    minor: 8000,
    error: '',
  });
  expect(parseCheckoutDiscount('21', 'percent', 80000).error).toMatch(/20%/);
});

it('allocates a checkout discount to real sale lines with a recorded reason', () => {
  const lines = [
    { id: 'a', quantity: 1, priceMinor: 80000, discountMinor: 0 },
  ];
  expect(allocateCheckoutDiscount(lines, 5000)).toEqual([
    {
      ...lines[0],
      discountMinor: 5000,
      discountReason: 'Скидка при оплате',
    },
  ]);
  expect(lines[0].discountMinor).toBe(0);
});

it('preserves line discounts and never rounds away money', () => {
  const lines = [
    {
      id: 'a',
      quantity: 2,
      priceMinor: 40000,
      discountMinor: 1000,
      discountReason: 'Уценка',
    },
  ];
  expect(allocateCheckoutDiscount(lines, 5000)?.[0]).toMatchObject({
    discountMinor: 3500,
    discountReason: 'Уценка; скидка при оплате',
  });
  expect(allocateCheckoutDiscount(lines, 1)).toBeNull();
});

it('rejects any allocation that would exceed the cashier line discount limit', () => {
  expect(
    allocateCheckoutDiscount(
      [{ id: 'a', quantity: 1, priceMinor: 10000 }],
      2100,
    ),
  ).toBeNull();
});
