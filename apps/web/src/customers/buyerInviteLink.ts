/** The token is a single-use 15-minute shop invitation, not a login credential. */
export function parseBuyerInviteFragment(fragment: string): string {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('invite');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}

export function parseBuyerAuthTokenFragment(fragment: string): string {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const token = params.get('token') || params.get('login-token');
  return token && /^[A-Za-z0-9_-]{32,64}$/.test(token) ? token : '';
}

export function buyerInviteLink(token: string, origin: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('Недействительный код приглашения');
  }
  const safeOrigin = new URL(origin).origin;
  return safeOrigin + '/buyer#invite=' + token;
}

export function normalizePhoneForWhatsApp(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return '';
  if (digits.length === 10 && digits.startsWith('0')) {
    return '996' + digits.slice(1);
  }
  if (digits.length === 9) {
    return '996' + digits;
  }
  return digits;
}

function inviteMessageText(name: string, link: string): string {
  return `Здравствуйте, ${name}! Отслеживайте покупки и баланс в личном кабинете MyStore: ${link}`;
}

export function buyerInviteWhatsAppUrl(
  phone: string | undefined,
  name: string,
  link: string,
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(
    inviteMessageText(name, link),
  )}`;
}

export function buyerInviteSmsUrl(
  phone: string | undefined,
  name: string,
  link: string,
): string | null {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) return null;
  return `sms:+${normalized}?body=${encodeURIComponent(
    inviteMessageText(name, link),
  )}`;
}
