import { GmailApiTransport } from '../src/email/gmail-api-transport';
import { readEmailConfig } from '../src/email/email-config';
describe('Gmail HTTPS delivery', () => {
  const config = {
    EMAIL_ENABLED: 'true',
    EMAIL_PROVIDER: 'gmail',
    GMAIL_FROM: 'owner@gmail.com',
    GMAIL_CLIENT_ID: 'test-client',
    GMAIL_CLIENT_SECRET: 'test-secret',
    GMAIL_REFRESH_TOKEN: 'test-refresh',
    EMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    PUBLIC_BASE_URL: 'http://localhost:43104',
  };
  it('accepts Gmail configuration without SMTP and rejects missing or unexpected providers', () => {
    const c = readEmailConfig(config);
    expect(c.enabled).toBe(true);
    expect(c).toMatchObject({ provider: 'gmail', from: 'owner@gmail.com' });
    expect(() =>
      readEmailConfig({ ...config, GMAIL_REFRESH_TOKEN: '' }),
    ).toThrow();
    expect(() =>
      readEmailConfig({ ...config, EMAIL_PROVIDER: 'unknown' }),
    ).toThrow();
  });
  it('refreshes OAuth token and submits base64url MIME with stable Message-ID', async () => {
    const seen: { url: string; options: any }[] = [];
    const http: typeof fetch = async (url, options) => {
      seen.push({ url: String(url), options });
      return new Response(
        JSON.stringify(
          String(url).includes('/token')
            ? {
                access_token: 'short-access',
                expires_in: 3600,
                token_type: 'Bearer',
              }
            : { id: 'gmail-message-id' },
        ),
        { status: 200 },
      );
    };
    const c = readEmailConfig(config);
    if (!c.enabled || c.provider !== 'gmail')
      throw new Error('Expected gmail config');
    const transport = new GmailApiTransport(c, http);
    await transport.send(
      {
        to: 'buyer@example.test',
        subject: 'Заказ готов',
        text: 'Ваш заказ готов.',
      },
      '<stable-id@mystore.invalid>',
    );
    await transport.send(
      { to: 'other@example.test', subject: 'Hello', text: 'body' },
      '<second@mystore.invalid>',
    );
    expect(seen.map((s) => s.url)).toEqual([
      'https://oauth2.googleapis.com/token',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    ]);
    expect(new URLSearchParams(seen[0].options.body).get('refresh_token')).toBe(
      'test-refresh',
    );
    expect(seen[1].options.headers.authorization).toBe('Bearer short-access');
    const raw = JSON.parse(seen[1].options.body).raw;
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
    const mime = Buffer.from(raw, 'base64url').toString();
    expect(mime).toContain('To: buyer@example.test');
    expect(mime).toContain('Message-ID: <stable-id@mystore.invalid>');
    expect(mime).toContain('From: owner@gmail.com');
  });
  it('rejects HTTP failure or malformed acceptance without leaking credentials', async () => {
    const c = readEmailConfig(config);
    if (!c.enabled || c.provider !== 'gmail')
      throw new Error('Expected gmail config');
    const http: typeof fetch = async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes('/token')
            ? { access_token: 'access', expires_in: 3600 }
            : { error: 'test-secret test-refresh' },
        ),
        { status: String(url).includes('/token') ? 200 : 403 },
      );
    await expect(
      new GmailApiTransport(c, http).send(
        { to: 'b@example.test', subject: 's', text: 't' },
        '<id@test>',
      ),
    ).rejects.toThrow('Gmail delivery failed');
    const malformed: typeof fetch = async (url) =>
      new Response(
        JSON.stringify(
          String(url).includes('/token')
            ? { access_token: 'access', expires_in: 3600 }
            : {},
        ),
      );
    await expect(
      new GmailApiTransport(c, malformed).send(
        { to: 'b@example.test', subject: 's', text: 't' },
        '<id@test>',
      ),
    ).rejects.toThrow('Gmail delivery failed');
  });
});
