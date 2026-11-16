import { describe, expect, it } from 'vitest';
import {
  buyerInviteLink,
  buyerInviteSmsUrl,
  buyerInviteWhatsAppUrl,
  normalizePhoneForWhatsApp,
  parseBuyerInviteFragment,
  parseBuyerAuthTokenFragment,
} from './buyerInviteLink';

const token = 'a'.repeat(43);

describe('buyer activation invitation', () => {
  it('places the token in a URL fragment rather than the server request', () => {
    const link = buyerInviteLink(token, 'https://mystore.test/foo');
    expect(link).toBe('https://mystore.test/buyer#invite=' + token);
    expect(new URL(link).pathname).toBe('/buyer');
    expect(new URL(link).search).toBe('');
  });
  it('rejects malformed and missing invitations', () => {
    expect(parseBuyerInviteFragment('#invite=' + token)).toBe(token);
    expect(parseBuyerInviteFragment('#invite=abc')).toBe('');
    expect(parseBuyerInviteFragment('#other=' + token)).toBe('');
    expect(() => buyerInviteLink('bad', 'https://mystore.test')).toThrow();
  });
  it('parses auth token fragments', () => {
    expect(parseBuyerAuthTokenFragment('#token=' + token)).toBe(token);
    expect(parseBuyerAuthTokenFragment('#login-token=' + token)).toBe(token);
    expect(parseBuyerAuthTokenFragment('#token=invalid')).toBe('');
    expect(parseBuyerAuthTokenFragment('')).toBe('');
  });
  it('normalizes Kyrgyz phone numbers and builds WhatsApp/SMS invite links', () => {
    expect(normalizePhoneForWhatsApp('0555 12-34-56')).toBe('996555123456');
    expect(normalizePhoneForWhatsApp('+996 (700) 11-22-33')).toBe(
      '996700112233',
    );
    expect(normalizePhoneForWhatsApp('555123456')).toBe('996555123456');
    expect(normalizePhoneForWhatsApp('123')).toBe('');

    const link = buyerInviteLink(token, 'https://mystore.test');
    const wa = buyerInviteWhatsAppUrl('0555123456', 'Айбек', link);
    expect(wa).toContain('https://wa.me/996555123456?text=');
    expect(decodeURIComponent(wa!)).toContain(link);

    const sms = buyerInviteSmsUrl('0555123456', 'Айбек', link);
    expect(sms).toContain('sms:+996555123456?body=');
    expect(decodeURIComponent(sms!)).toContain(link);

    expect(buyerInviteWhatsAppUrl('', 'Айбек', link)).toBeNull();
    expect(buyerInviteSmsUrl('', 'Айбек', link)).toBeNull();
  });
});
