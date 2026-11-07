import { describe, expect, it } from 'vitest';
import { buyerInviteLink, parseBuyerInviteFragment } from './buyerInviteLink';

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
});
