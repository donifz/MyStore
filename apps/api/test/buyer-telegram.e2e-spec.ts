import request from 'supertest';
import { createApp } from '../src/app';
import { BuyerTelegramService } from '../src/customers/buyer-telegram.service';
import { setup, teardown, fixture } from './helpers';

describe('Telegram verification of buyer phone ownership', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  let mockedSend: jest.SpyInstance;
  const origin = 'http://localhost:5173';
  const secret = 'test_telegram_webhook_secret_123';
  const app = () => c.app.getHttpServer();

  beforeAll(() => {
    process.env.TELEGRAM_BOT_TOKEN =
      '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
    process.env.TELEGRAM_BOT_USERNAME = 'mystore_test_bot';
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    mockedSend = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
  });

  afterAll(() => {
    mockedSend.mockRestore();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE buyer_accounts CASCADE');
    mockedSend.mockClear();
  });
  afterEach(async () => {
    await teardown(c);
  });

  async function buyer(phone = '+996700123456') {
    await request(app())
      .post('/buyer/register')
      .set('Origin', origin)
      .send({ phone, name: 'Test Buyer', password: 'test-buyer-password-123' })
      .expect(201);
    const agent = request.agent(app());
    const login = await agent
      .post('/buyer/login')
      .set('Origin', origin)
      .send({ phone, password: 'test-buyer-password-123' })
      .expect(201);
    return { agent, csrf: login.body.csrfToken as string };
  }

  function webhook(message: object, suppliedSecret = secret) {
    return request(app())
      .post('/integrations/telegram/buyer-webhook')
      .set('x-telegram-bot-api-secret-token', suppliedSecret)
      .send({ update_id: 1, message });
  }

  function message(body: object) {
    return {
      chat: { id: 234567890, type: 'private' },
      from: { id: 234567890, is_bot: false },
      ...body,
    };
  }

  it('requires buyer session and CSRF to issue one-time Telegram challenge', async () => {
    const account = await buyer();
    await request(app()).post('/buyer/telegram/start').send({}).expect(401);
    await account.agent
      .post('/buyer/telegram/start')
      .set('Origin', origin)
      .send({})
      .expect(403);
    const res = await account.agent
      .post('/buyer/telegram/start')
      .set('Origin', origin)
      .set('x-csrf-token', account.csrf)
      .send({})
      .expect(201);
    expect(res.body.url).toMatch(
      /^https:\/\/t\.me\/mystore_test_bot\?start=[A-Za-z0-9_-]{32}$/,
    );
    const token = res.body.url.split('start=')[1];
    const [stored] = await c.db.query(
      'SELECT token_hash FROM buyer_telegram_verifications',
    );
    expect(stored.token_hash).not.toBe(token);
    await account.agent
      .post('/buyer/telegram/start')
      .set('Origin', origin)
      .set('x-csrf-token', account.csrf)
      .send({})
      .expect(429);
  });

  it("requires correct bot secret and the user's own verified contact", async () => {
    const account = await buyer();
    // Before verification matching customer records remain private.
    await request(app())
      .post(`/shops/${fixture.shop}/customers`)
      .auth(c.cashier, { type: 'bearer' })
      .send({ name: 'Telegram Customer', phone: '+996700123456' })
      .expect(201);
    expect(
      (await account.agent.get('/buyer/me').expect(200)).body.shops,
    ).toEqual([]);
    const issued = (
      await account.agent
        .post('/buyer/telegram/start')
        .set('Origin', origin)
        .set('x-csrf-token', account.csrf)
        .send({})
        .expect(201)
    ).body;
    const token = issued.url.split('start=')[1];
    await webhook(
      message({ text: '/start ' + token }),
      'incorrect_secret_123',
    ).expect(403);
    expect(
      (await account.agent.get('/buyer/me').expect(200)).body.phoneVerified,
    ).toBe(false);
    await webhook(message({ text: '/start ' + token })).expect(201);
    await webhook(
      message({
        contact: { phone_number: '+996700123456', user_id: 3333333 },
      }),
    ).expect(201);
    expect(
      (await account.agent.get('/buyer/me').expect(200)).body.phoneVerified,
    ).toBe(false);
    await webhook(
      message({
        contact: { phone_number: '+996555123456', user_id: 234567890 },
      }),
    ).expect(201);
    expect(
      (await account.agent.get('/buyer/me').expect(200)).body.phoneVerified,
    ).toBe(false);
    await webhook(
      message({
        contact: { phone_number: '+996700123456', user_id: 234567890 },
      }),
    ).expect(201);
    const verifiedAccount = (await account.agent.get('/buyer/me').expect(200))
      .body;
    expect(verifiedAccount.phoneVerified).toBe(true);
    expect(verifiedAccount.shops).toEqual([
      { shopId: fixture.shop, shopName: 'Test Shop' },
    ]);
    const [buyerRow] = await c.db.query(
      'SELECT telegram_user_id FROM buyer_accounts LIMIT 1',
    );
    expect(Number(buyerRow.telegram_user_id)).toBe(234567890);
    await webhook(
      message({
        contact: { phone_number: '+996700123456', user_id: 234567890 },
      }),
    ).expect(201);
    const [{ count }] = await c.db.query(
      'SELECT count(*)::int AS count FROM buyer_telegram_verifications WHERE used_at IS NOT NULL',
    );
    expect(count).toBe(1);
  });

  it('expired link cannot verify phone even with correct Telegram contact', async () => {
    const account = await buyer();
    const { url } = (
      await account.agent
        .post('/buyer/telegram/start')
        .set('Origin', origin)
        .set('x-csrf-token', account.csrf)
        .send({})
        .expect(201)
    ).body;
    await c.db.query(
      "UPDATE buyer_telegram_verifications SET created_at=now()-interval '11 minutes', expires_at=now()-interval '1 minute' WHERE used_at IS NULL",
    );
    await webhook(message({ text: '/start ' + url.split('start=')[1] })).expect(
      201,
    );
    await webhook(
      message({
        contact: { phone_number: '+996700123456', user_id: 234567890 },
      }),
    ).expect(201);
    expect(
      (await account.agent.get('/buyer/me').expect(200)).body.phoneVerified,
    ).toBe(false);
  });

  it('registers a webhook only with matching bot identity and explicit production flags', async () => {
    const telegram = c.app.get(BuyerTelegramService);
    const original = {
      node: process.env.NODE_ENV,
      auto: process.env.TELEGRAM_AUTO_WEBHOOK,
      enabled: process.env.TELEGRAM_VERIFY_ENABLED,
      base: process.env.PUBLIC_BASE_URL,
    };
    try {
      process.env.NODE_ENV = 'production';
      process.env.TELEGRAM_VERIFY_ENABLED = 'true';
      process.env.TELEGRAM_AUTO_WEBHOOK = 'true';
      process.env.PUBLIC_BASE_URL = 'https://mystore.tezkur.kg';
      mockedSend
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            ok: true,
            result: { username: 'mystore_test_bot', is_bot: true },
          }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);
      expect(telegram.config().enabled).toBe(false);
      await telegram.registerWebhook();
      expect(mockedSend).toHaveBeenCalledTimes(2);
      expect(String(mockedSend.mock.calls[0][0])).toContain('/getMe');
      expect(String(mockedSend.mock.calls[1][0])).toContain('/setWebhook');
      const payload = JSON.parse(mockedSend.mock.calls[1][1].body as string);
      expect(payload).toEqual({
        url: 'https://mystore.tezkur.kg/api/integrations/telegram/buyer-webhook',
        secret_token: secret,
        allowed_updates: ['message'],
        drop_pending_updates: false,
        max_connections: 4,
      });
      expect(telegram.config().enabled).toBe(true);
    } finally {
      if (original.node === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = original.node;
      if (original.auto === undefined) delete process.env.TELEGRAM_AUTO_WEBHOOK;
      else process.env.TELEGRAM_AUTO_WEBHOOK = original.auto;
      if (original.enabled === undefined)
        delete process.env.TELEGRAM_VERIFY_ENABLED;
      else process.env.TELEGRAM_VERIFY_ENABLED = original.enabled;
      if (original.base === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = original.base;
    }
  });

  it('when not configured, Telegram stays unavailable and normal buyer login works', async () => {
    const account = await buyer();
    const saved = process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_TOKEN;
    try {
      const result = await account.agent
        .get('/buyer/telegram/config')
        .expect(200);
      expect(result.body.enabled).toBe(false);
      await account.agent
        .post('/buyer/telegram/start')
        .set('Origin', origin)
        .set('x-csrf-token', account.csrf)
        .send({})
        .expect(503);
      expect(
        (await account.agent.get('/buyer/me').expect(200)).body.phoneVerified,
      ).toBe(false);
    } finally {
      process.env.TELEGRAM_BOT_TOKEN = saved;
    }
  });

  it('allows buyer to authenticate and reset password via Telegram bot', async () => {
    // Register customer account first with known phone
    await request(app())
      .post('/buyer/register')
      .set('Origin', origin)
      .send({
        phone: '+996700111222',
        name: 'Telegram User',
        password: 'old-password-123',
      })
      .expect(201);

    // Request telegram auth without session
    const reqRes = await request(app())
      .post('/buyer/telegram/auth-request')
      .set('Origin', origin)
      .send({})
      .expect(201);

    expect(reqRes.body.token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(reqRes.body.url).toContain('start=auth_' + reqRes.body.token);

    // Initial poll says pending
    const pollPending = await request(app())
      .post('/buyer/telegram/auth-poll')
      .set('Origin', origin)
      .send({ token: reqRes.body.token })
      .expect(200);
    expect(pollPending.body.status).toBe('pending');

    // User sends /start auth_<token>
    await webhook(message({ text: '/start auth_' + reqRes.body.token })).expect(
      201,
    );

    // User shares contact with matching phone
    await webhook(
      message({
        contact: {
          user_id: 234567890,
          phone_number: '+996700111222',
        },
      }),
    ).expect(201);

    // Polling now returns ready and sets session cookie
    const agent = request.agent(app());
    const pollReady = await agent
      .post('/buyer/telegram/auth-poll')
      .set('Origin', origin)
      .send({ token: reqRes.body.token })
      .expect(200);

    expect(pollReady.body.status).toBe('ready');
    expect(pollReady.body.csrfToken).toBeTruthy();

    // Authenticated user can fetch /buyer/me
    const me = await agent.get('/buyer/me').expect(200);
    expect(me.body.phone).toBe('+996700111222');
    expect(me.body.phoneVerified).toBe(true);

    // User can set new password in cabinet
    await agent
      .post('/buyer/change-password')
      .set('Origin', origin)
      .set('x-csrf-token', pollReady.body.csrfToken)
      .send({ password: 'brand-new-password-456' })
      .expect(201);

    // Login with new password succeeds
    await request(app())
      .post('/buyer/login')
      .set('Origin', origin)
      .send({ phone: '+996700111222', password: 'brand-new-password-456' })
      .expect(201);
  });
});
