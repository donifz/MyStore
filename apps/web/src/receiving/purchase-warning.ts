import { parseSom } from '../api/money';

export function somOrNull(value: string): number | null {
  if (!value.trim()) return null;
  try {
    return parseSom(value);
  } catch {
    return null;
  }
}

export function isPurchaseAboveSale(
  unitCostText: string,
  salePriceMinor: number | null,
): boolean {
  const cost = somOrNull(unitCostText);
  return cost !== null && salePriceMinor !== null && cost > salePriceMinor;
}
