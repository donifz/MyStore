import { parseSom } from '../api/money';

export type CheckoutDiscountMode = 'som' | 'percent';

export type CheckoutDiscountLine = {
  id: string;
  quantity: number;
  priceMinor: number;
  discountMinor?: number;
  discountReason?: string;
};

/** All calculations use integer tyiyn. Discounts never infer themselves from cash received. */
export function parseCheckoutDiscount(
  text: string,
  mode: CheckoutDiscountMode,
  totalMinor: number,
): { minor: number; error: string } {
  if (!text.trim()) return { minor: 0, error: '' };
  if (!Number.isSafeInteger(totalMinor) || totalMinor < 0)
    return { minor: 0, error: 'Некорректная сумма чека.' };
  let minor = 0;
  try {
    if (mode === 'som') {
      minor = parseSom(text.trim());
    } else {
      const clean = text.trim().replace(',', '.');
      if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(clean))
        throw new Error('Некорректный процент.');
      const [whole, decimal = ''] = clean.split('.');
      const basisPoints = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
      if (basisPoints > 2000n)
        return { minor: 0, error: 'Скидка не должна превышать 20%.' };
      minor = Number((BigInt(totalMinor) * basisPoints + 5000n) / 10000n);
    }
  } catch {
    return { minor: 0, error: 'Проверьте значение скидки.' };
  }
  if (!Number.isSafeInteger(minor) || minor < 0 || minor > totalMinor)
    return { minor: 0, error: 'Скидка превышает сумму чека.' };
  if (BigInt(minor) * 5n > BigInt(totalMinor))
    return { minor: 0, error: 'Скидка не должна превышать 20%.' };
  return { minor, error: '' };
}

/**
 * Allocate a receipt discount to units without changing stock document invariants.
 * Return null when exact allocation respecting a 20%-per-line cap is impossible.
 * An unallocatable one-tyiyn remainder is rejected, never silently discarded.
 */
export function allocateCheckoutDiscount<T extends CheckoutDiscountLine>(
  lines: T[],
  discountMinor: number,
): (T & { discountMinor: number; discountReason?: string })[] | null {
  if (!Number.isSafeInteger(discountMinor) || discountMinor < 0) return null;
  const result = lines.map((line) => ({
    ...line,
    discountMinor: line.discountMinor ?? 0,
  }));
  if (discountMinor === 0) return result;
  let remainder = discountMinor;
  // Try a small first unit to avoid truncation when quantities differ.
  const indexes = result
    .map((line, index) => ({ index, quantity: line.quantity }))
    .sort((a, b) => a.quantity - b.quantity);
  for (const { index } of indexes) {
    const line = result[index];
    if (
      !Number.isSafeInteger(line.priceMinor) ||
      !Number.isSafeInteger(line.quantity) ||
      line.quantity <= 0
    )
      return null;
    const ceiling = Math.floor(line.priceMinor / 5);
    const capacity = Math.max(0, ceiling - line.discountMinor);
    const each = Math.min(capacity, Math.floor(remainder / line.quantity));
    if (each > 0) {
      line.discountMinor += each;
      line.discountReason = line.discountReason
        ? line.discountReason + '; скидка при оплате'
        : 'Скидка при оплате';
      remainder -= each * line.quantity;
    }
    if (remainder === 0) break;
  }
  return remainder === 0 ? result : null;
}
