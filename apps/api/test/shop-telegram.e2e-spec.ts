import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('Shop Telegram Owner Daily Shift Summary (E2E)', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  let mockedFetch: jest.SpyInstance;
  const secret = 'test_telegram_webhook_secret_123';
  const app = () => c.app.getHttpServer();

  beforeAll(() => {
    process.env.TELEGRAM_BOT_TOKEN =
      '123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi';
    process.env.TELEGRAM_BOT_USERNAME = 'mystore_test_bot';
    process.env.TELEGRAM_WEBHOOK_SECRET = secret;
    mockedFetch = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, text: async () => 'ok' } as any);
  });

  afterAll(() => {
    mockedFetch.mockRestore();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_BOT_USERNAME;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
  });

  beforeEach(async () => {
    c = await setup(createApp);
    mockedFetch.mockClear();
  });

  afterEach(async () => {
    await teardown(c);
  });

  function webhook(message: object) {
    return request(app())
      .post('/integrations/telegram/buyer-webhook')
      .set('x-telegram-bot-api-secret-token', secret)
      .send({ update_id: 1, message });
  }

  it('only owner can view status and issue link-token', async () => {
    await request(app())
      .get(`/shops/${fixture.shop}/telegram/status`)
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);

    const statusRes = await request(app())
      .get(`/shops/${fixture.shop}/telegram/status`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);

    expect(statusRes.body.enabled).toBe(true);
    expect(statusRes.body.botUsername).toBe('mystore_test_bot');
    expect(statusRes.body.subscription).toBeNull();

    const tokenRes = await request(app())
      .post(`/shops/${fixture.shop}/telegram/link-token`)
      .auth(c.owner, { type: 'bearer' })
      .send({})
      .expect(201);

    expect(tokenRes.body.url).toContain(
      'https://t.me/mystore_test_bot?start=owner_',
    );
    expect(tokenRes.body.expiresIn).toBe(900);
  });

  it('connects owner via /start owner_<token> in webhook and dispatches welcome message', async () => {
    const tokenRes = await request(app())
      .post(`/shops/${fixture.shop}/telegram/link-token`)
      .auth(c.owner, { type: 'bearer' })
      .send({})
      .expect(201);

    const tokenMatch = tokenRes.body.url.match(/start=owner_([A-Za-z0-9_-]+)/);
    expect(tokenMatch).toBeTruthy();
    const token = tokenMatch[1];

    mockedFetch.mockClear();

    // Owner taps start in Telegram bot
    await webhook({
      chat: { id: 987654321, type: 'private' },
      from: {
        id: 987654321,
        is_bot: false,
        username: 'shop_owner_tg',
        first_name: 'Owner',
      },
      text: `/start owner_${token}`,
    }).expect(201);

    // Verify subscription created
    const statusRes = await request(app())
      .get(`/shops/${fixture.shop}/telegram/status`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);

    expect(statusRes.body.subscription).not.toBeNull();
    expect(statusRes.body.subscription.chatId).toBe('987654321');
    expect(statusRes.body.subscription.username).toBe('shop_owner_tg');

    // Verify welcome message dispatched
    expect(mockedFetch).toHaveBeenCalled();
    const callArgs = mockedFetch.mock.calls[0];
    expect(callArgs[0]).toContain('api.telegram.org/bot');
    const body = JSON.parse(callArgs[1].body);
    expect(body.chat_id).toBe(987654321);
    expect(body.text).toContain('Telegram успешно подключён');
    expect(body.text).toContain('Test Shop');
  });

  it('sends test summary to connected chat', async () => {
    await request(app())
      .post(`/shops/${fixture.shop}/telegram/manual-subscribe`)
      .auth(c.owner, { type: 'bearer' })
      .send({ chatId: '987654321' })
      .expect(201);

    mockedFetch.mockClear();

    await request(app())
      .post(`/shops/${fixture.shop}/telegram/test-summary`)
      .auth(c.owner, { type: 'bearer' })
      .send({})
      .expect(201);

    expect(mockedFetch).toHaveBeenCalled();
    const callArgs = mockedFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.chat_id).toBe('987654321');
    expect(body.text.toLowerCase()).toContain('сводка закрытия смены');
    expect(body.text).toContain('Выручка');
  });

  it('triggers shift close summary upon closing a shift', async () => {
    // Subscribe owner
    await request(app())
      .post(`/shops/${fixture.shop}/telegram/manual-subscribe`)
      .auth(c.owner, { type: 'bearer' })
      .send({ chatId: '987654321' })
      .expect(201);

    // Open a shift
    const openRes = await request(app())
      .post(`/shops/${fixture.shop}/pos/shifts`)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', 'test-shift-open-tg-1')
      .send({ openingCashMinor: 500000 })
      .expect(201);

    const shiftId = openRes.body.id;
    mockedFetch.mockClear();

    // Close shift with itemized expenses
    await request(app())
      .post(`/shops/${fixture.shop}/pos/shifts/${shiftId}/close`)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', 'test-shift-close-tg-1')
      .send({
        actualCashMinor: 480000,
        expenses: [{ reason: 'Такси курьеру', amountMinor: 20000 }],
      })
      .expect(201);

    expect(mockedFetch).toHaveBeenCalled();
    const lastCall = mockedFetch.mock.calls[mockedFetch.mock.calls.length - 1];
    const body = JSON.parse(lastCall[1].body);
    expect(String(body.chat_id)).toBe('987654321');
    expect(body.text.toLowerCase()).toContain('сводка закрытия смены');
    expect(body.text).toContain('Такси курьеру');
    expect(body.text).toContain('В кассе на конец смены');
  });
});
