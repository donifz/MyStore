import { BadRequestException } from '@nestjs/common';
export const MAX_MONEY = BigInt(Number.MAX_SAFE_INTEGER);
export function safeMoney(value: bigint): number {
  if (value < 0n || value > MAX_MONEY)
    throw new BadRequestException('Money outside safe range');
  return Number(value);
}
export function quantity(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000000)
    throw new BadRequestException('Invalid quantity');
  return value;
}
export function minor(value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new BadRequestException('Invalid money');
  return BigInt(value);
}
