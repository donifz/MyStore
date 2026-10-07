import { ForbiddenException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
export function validateOrigin(origin: string | undefined): void {
  const origins = (process.env.WEB_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  if (!origin || !origins.includes(origin))
    throw new ForbiddenException('Untrusted origin');
}
export function csrfFor(token: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET!)
    .update('browser-csrf:' + token)
    .digest('hex');
}
export function validateCsrf(token: string, supplied: unknown): void {
  const expected = csrfFor(token);
  if (
    typeof supplied !== 'string' ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    throw new ForbiddenException('Invalid CSRF token');
}
export function sessionCookie(header: string | undefined): string | undefined {
  return header
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('mystore_session='))
    ?.slice(16);
}
