import { describe, expect, it } from 'vitest';
import { normalizeDecimalInput, normalizeIntegerInput } from './numeric-input';

describe('numeric-input normalization', () => {
  it('strips leading zeros from integers while keeping 0 and empty string', () => {
    expect(normalizeIntegerInput('')).toBe('');
    expect(normalizeIntegerInput('0')).toBe('0');
    expect(normalizeIntegerInput('00')).toBe('0');
    expect(normalizeIntegerInput('01')).toBe('1');
    expect(normalizeIntegerInput('0052')).toBe('52');
    expect(normalizeIntegerInput('120')).toBe('120');
  });

  it('normalizes decimals without breaking 0.5', () => {
    expect(normalizeDecimalInput('')).toBe('');
    expect(normalizeDecimalInput('0')).toBe('0');
    expect(normalizeDecimalInput('01')).toBe('1');
    expect(normalizeDecimalInput('01.5')).toBe('1.5');
    expect(normalizeDecimalInput('0.5')).toBe('0.5');
    expect(normalizeDecimalInput('0,75')).toBe('0.75');
    expect(normalizeDecimalInput('.5')).toBe('0.5');
  });
});
