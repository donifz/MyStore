import { BadRequestException } from '@nestjs/common';

/**
 * Normalize Kyrgyzstan subscriber numbers into +996 followed by nine digits.
 * This is structural validation only: it does NOT verify ownership, assignment,
 * or reachability of the entered number.
 */
export function normalizeKyrgyzPhone(input: string): string {
  if (typeof input !== 'string') {
    throw new BadRequestException('Укажите номер телефона Кыргызстана');
  }
  const compact = input.replace(/[\s()\-]/g, '');
  const digits = compact.startsWith('+') ? compact.slice(1) : compact;
  const normalized = /^0[1-9]\d{8}$/.test(digits)
    ? '996' + digits.slice(1)
    : digits;
  if (!/^996[1-9]\d{8}$/.test(normalized)) {
    throw new BadRequestException(
      'Укажите кыргызстанский номер в формате +996 XXX XXX XXX',
    );
  }
  return '+' + normalized;
}
