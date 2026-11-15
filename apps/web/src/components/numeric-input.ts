/**
 * Normalizes an integer input string so leading zeros (e.g. "01", "005")
 * are stripped immediately while keeping "" (empty) and "0" intact.
 */
export function normalizeIntegerInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/^0+(?=\d)/, '');
}

/**
 * Normalizes a decimal input string (commas converted to dots, single decimal
 * separator, no leading zeros like "01.5" -> "1.5" while preserving "0.5").
 */
export function normalizeDecimalInput(raw: string): string {
  const cleaned = raw.replace(',', '.').replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const dotIdx = cleaned.indexOf('.');
  if (dotIdx === -1) {
    return cleaned.replace(/^0+(?=\d)/, '');
  }
  const intPart = cleaned.slice(0, dotIdx).replace(/^0+(?=\d)/, '') || '0';
  const fracPart = cleaned.slice(dotIdx + 1).replace(/\./g, '');
  return `${intPart}.${fracPart}`;
}
