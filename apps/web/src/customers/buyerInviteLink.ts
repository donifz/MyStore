/** The token is a single-use 15-minute shop invitation, not a login credential. */
export function parseBuyerInviteFragment(fragment: string): string {
  const token = new URLSearchParams(fragment.replace(/^#/, '')).get('invite');
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : '';
}

export function parseBuyerAuthTokenFragment(fragment: string): string {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const token = params.get('token') || params.get('login-token');
  return token && /^[a-f0-9]{64}$/.test(token) ? token : '';
}

export function buyerInviteLink(token: string, origin: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error('Недействительный код приглашения');
  }
  const safeOrigin = new URL(origin).origin;
  return safeOrigin + '/buyer#invite=' + token;
}
