/**
 * Format a Kyrgyz number while it is being typed. Accepts +996, 996 and
 * domestic 0-prefixed numbers pasted from contacts. Never keeps more than
 * nine subscriber digits. This is display-only: the API validates numbers.
 */
export function formatKyrgyzPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, '');
  let subscriber = digits;

  if (digits.startsWith('996')) {
    subscriber = digits.slice(3);
  } else if (digits.startsWith('0')) {
    subscriber = digits.slice(1);
  }

  const local = subscriber.slice(0, 9);
  if (!local) return '';

  const parts = [
    '+996',
    local.slice(0, 3),
    local.slice(3, 6),
    local.slice(6, 9),
  ];
  return parts.filter(Boolean).join(' ');
}

/** HTML validation mirrors the server's +996 + nine digit rule. */
export const KYRGYZ_PHONE_PATTERN =
  '[+]996 [1-9][0-9]{2} [0-9]{3} [0-9]{3}';
