import { describe, expect, it } from 'vitest';
import {
  formatKyrgyzPhoneInput,
  KYRGYZ_PHONE_PATTERN,
} from './kyrgyzPhoneMask';

describe('Kyrgyz phone input mask', () => {
  it.each([
    ['700123456', '+996 700 123 456'],
    ['0700123456', '+996 700 123 456'],
    ['996700123456', '+996 700 123 456'],
    ['+996 (700) 123-456', '+996 700 123 456'],
    ['+996 700 123 456 99999', '+996 700 123 456'],
    ['7', '+996 7'],
    ['7001', '+996 700 1'],
    ['700123', '+996 700 123'],
    ['', ''],
    ['+996', ''],
    ['abc 700-123-456', '+996 700 123 456'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatKyrgyzPhoneInput(value)).toBe(expected);
  });

  it('keeps a stable mask when editing the formatted number', () => {
    let value = formatKyrgyzPhoneInput('0700123456');
    expect(value).toBe('+996 700 123 456');
    value = formatKyrgyzPhoneInput(value.slice(0, -1));
    expect(value).toBe('+996 700 123 45');
    value = formatKyrgyzPhoneInput(value + '6');
    expect(value).toBe('+996 700 123 456');
  });

  it('only marks a complete valid +996 number as form-valid', () => {
    const pattern = new RegExp('^(?:' + KYRGYZ_PHONE_PATTERN + ')$');
    expect(pattern.test('+996 700 123 456')).toBe(true);
    expect(pattern.test('+996 000 123 456')).toBe(false);
    expect(pattern.test('+996 700 123 45')).toBe(false);
    expect(pattern.test('+996 700 123 456 7')).toBe(false);
  });
});
