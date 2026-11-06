/**
 * Format a Kyrgyz number while it is being typed. Accepts +996, 996 and
 * domestic 0-prefixed numbers pasted from contacts. Never keeps more than
 * nine subscriber digits. This is display-only: the API validates numbers.
 */
export function formatKyrgyzPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '');
  const local = (digits.startsWith('996')
    ? digits.slice(3)
    : digits.startsWith('0')
      ? digits.slice(1)
      : digits
  ).slice(0, 9);

  if (!local) return '';

  return [
    '+996',
    local.slice(0, 3),
    local.slice(3, 6),
    local.slice(6, 9),
  ]
    .filter(Boolean)
    .join(' ');
}

/** HTML validation mirrors the server's +996 + nine digit rule. */
export const KYRGYZ_PHONE_PATTERN =
  '[+]996 [1-9][0-9]{2} [0-9]{3} [0-9]{3}';
