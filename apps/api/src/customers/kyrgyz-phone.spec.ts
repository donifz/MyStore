import { normalizeKyrgyzPhone } from './kyrgyz-phone';

describe('Kyrgyzstan phone formatting', () => {
  it.each([
    ['+996 700 123 456', '+996700123456'],
    ['0700 123 456', '+996700123456'],
    ['996700123456', '+996700123456'],
    ['+996 (555) 12-34-56', '+996555123456'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeKyrgyzPhone(input)).toBe(expected);
  });

  it.each([
    '+7 700 123 4567',
    '070012345',
    '+996000123456',
    '+9967001234567',
    '123',
    '',
  ])('rejects an invalid number: %s', (input) =>
    expect(() => normalizeKyrgyzPhone(input)).toThrow(),
  );
});
