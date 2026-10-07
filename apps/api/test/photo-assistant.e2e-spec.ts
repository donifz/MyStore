import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('photo product suggestions', () => {
  let c: Awaited<ReturnType<typeof setup>>, photo: string;
  const originalKey = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_VISION_MODEL;
  const suggestion = {
    recognized: true,
    name: 'Красная чашка',
    description: 'Чашка красного цвета.',
    category: 'Посуда',
    confidence: 'medium',
    warning: 'Проверьте материал.',
  };
  const infer = (
    body: any = { photoDataUrl: photo },
    token?: string,
    shop = fixture.shop,
  ) =>
    request(c.app.getHttpServer())
      .post(`/shops/${shop}/variants/photo-assistant`)
      .auth(token ?? c.owner, { type: 'bearer' })
      .send(body);
  function provider(value: unknown = suggestion, status = 200) {
    return jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify(
          status === 200
            ? {
                candidates: [
                  {
                    finishReason: 'STOP',
                    content: { parts: [{ text: JSON.stringify(value) }] },
                  },
                ],
              }
            : { error: { message: 'private provider details' } },
        ),
        { status },
      ),
    );
  }
  beforeAll(async () => {
    photo =
      'data:image/jpeg;base64,' +
      (
        await sharp({
          create: { width: 8, height: 8, channels: 3, background: '#f00' },
        })
          .jpeg()
          .toBuffer()
      ).toString('base64');
  });
  beforeEach(async () => {
    process.env.GEMINI_API_KEY = 'test-only-not-a-real-api-key';
    process.env.GEMINI_VISION_MODEL = 'gemini-3.5-flash-lite';
    c = await setup(createApp);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.GEMINI_VISION_MODEL;
    else process.env.GEMINI_VISION_MODEL = originalModel;
    await teardown(c);
  });
  it('returns validated suggestions using only this shop categories without writing inventory', async () => {
    await c.db.query(
      "INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor,category) VALUES(gen_random_uuid(),$1,'Своя чашка','own',100,'Посуда'),(gen_random_uuid(),$2,'Чужой товар','other',100,'Чужая категория')",
      [fixture.shop, fixture.otherShop],
    );
    const upstream = provider();
    expect((await infer().expect(201)).body).toEqual(suggestion);
    const [url, options] = upstream.mock.calls[0];
    expect(String(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
    );
    const payload = JSON.parse(String(options!.body));
    expect(
      payload.contents[0].parts.some(
        (p: any) => p.inlineData?.mimeType === 'image/jpeg',
      ),
    ).toBe(true);
    expect(
      payload.generationConfig.responseFormat.text.schema.properties.category
        .enum,
    ).toEqual(['Посуда', 'Другое']);
    expect(String(options!.body)).not.toContain('Чужая категория');
    expect(String(options!.body)).not.toContain('owner@example.test');
    const [counts] = await c.db.query(
      'SELECT (SELECT count(*)::int FROM variants) variants,(SELECT count(*)::int FROM stock_documents) documents',
    );
    expect(counts).toEqual({ variants: 2, documents: 0 });
  });
  it('keeps photo receiving available when AI is not configured', async () => {
    delete process.env.GEMINI_API_KEY;
    const info = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants/photo-assistant`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(info.body.available).toBe(false);
    expect(info.body).not.toHaveProperty('apiKey');
    expect((await infer().expect(503)).body.code).toBe('AI_NOT_CONFIGURED');
  });
  it('rejects malformed photos and forbids cashier, foreign-shop and anonymous inference before calling provider', async () => {
    const upstream = provider();
    await infer({
      photoDataUrl: 'data:image/jpeg;base64,bm90YW5pbWFnZQ==',
    }).expect(400);
    await infer({ photoDataUrl: photo, unitCostMinor: 80 }).expect(400);
    await infer(undefined, c.cashier).expect(403);
    await infer(undefined, c.owner, fixture.otherShop).expect(403);
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants/photo-assistant`)
      .send({ photoDataUrl: photo })
      .expect(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects invented categories, extra prices and invalid provider output', async () => {
    for (const value of [
      { ...suggestion, category: 'Invented' },
      { ...suggestion, salePriceMinor: 500 },
      { ...suggestion, name: 'x'.repeat(201) },
      { recognized: true },
    ]) {
      const upstream = provider(value);
      expect((await infer().expect(502)).body.code).toBe('AI_INVALID_RESPONSE');
      upstream.mockRestore();
    }
  });
  it('handles unrecognized images without inventing a product', async () => {
    provider({ ...suggestion, recognized: false });
    const result = (await infer().expect(201)).body;
    expect(result.recognized).toBe(false);
    expect(result.name).toBe('');
    expect(result.category).toBe('');
    expect(result.description).toBe('');
  });
  it('bounds inference attempts and hides provider errors', async () => {
    provider(undefined, 429);
    for (let i = 0; i < 20; i++) {
      const r = await infer().expect(503);
      expect(JSON.stringify(r.body)).not.toContain('private provider details');
      expect(JSON.stringify(r.body)).not.toContain('test-only');
    }
    await infer().expect(429);
  });
  it.each([
    [400, 'AI_REQUEST_REJECTED', 'запрос'],
    [401, 'AI_ACCESS_DENIED', 'доступ'],
    [403, 'AI_ACCESS_DENIED', 'доступ'],
    [404, 'AI_MODEL_UNAVAILABLE', 'модель'],
    [429, 'AI_QUOTA_EXCEEDED', 'лимит'],
    [503, 'AI_UNAVAILABLE', 'временно'],
  ])(
    'explains provider HTTP %s without leaking provider data',
    async (status, code, message) => {
      const log = jest.spyOn(console, 'warn').mockImplementation(() => {});
      provider(undefined, status as number);
      const result = (await infer().expect(503)).body;
      expect(result.code).toBe(code);
      expect(result.message.toLowerCase()).toContain(message);
      expect(JSON.stringify(result)).not.toContain('private provider details');
      expect(log).toHaveBeenCalledWith(
        `photo_ai_provider_failure status=${status} model=gemini-3.5-flash-lite rpc=UNKNOWN reason=UNKNOWN`,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('test-only');
      expect(JSON.stringify(log.mock.calls)).not.toContain(photo);
    },
  );
  it.each([
    ['INVALID_ARGUMENT', 'API_KEY_INVALID', 'AI_KEY_INVALID'],
    ['INVALID_ARGUMENT', 'API_KEY_EXPIRED', 'AI_KEY_INVALID'],
    ['FAILED_PRECONDITION', undefined, 'AI_PROJECT_REQUIREMENTS'],
    ['INVALID_ARGUMENT', 'API_KEY_SERVICE_BLOCKED', 'AI_ACCESS_DENIED'],
  ])(
    'classifies safe Google error identifiers for %s/%s',
    async (status, reason, code) => {
      const log = jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              status,
              message: 'private test-only details',
              details: [{ reason, metadata: { key: 'private' } }],
            },
          }),
          { status: 400 },
        ),
      );
      const result = (await infer().expect(503)).body;
      expect(result.code).toBe(code);
      expect(JSON.stringify(result)).not.toContain('private');
      expect(log).toHaveBeenCalledWith(
        `photo_ai_provider_failure status=400 model=gemini-3.5-flash-lite rpc=${status} reason=${reason ?? 'UNKNOWN'}`,
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain('private');
    },
  );
  it.each([
    'not JSON',
    'x'.repeat(8193),
    JSON.stringify({
      error: { status: 'private', details: [{ reason: 'private' }] },
    }),
  ])('bounds and redacts untrusted error bodies', async (body) => {
    const log = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(body, { status: 400 }));
    expect((await infer().expect(503)).body.code).toBe('AI_REQUEST_REJECTED');
    expect(log).toHaveBeenCalledWith(
      'photo_ai_provider_failure status=400 model=gemini-3.5-flash-lite rpc=UNKNOWN reason=UNKNOWN',
    );
  });
  it('rejects oversized and truncated responses before offering suggestions', async () => {
    const upstream = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response('x'.repeat(65537)))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'MAX_TOKENS',
                content: { parts: [{ text: JSON.stringify(suggestion) }] },
              },
            ],
          }),
        ),
      );
    await infer().expect(502);
    await infer().expect(502);
    upstream.mockRestore();
    provider();
    await infer().expect(201);
  });
  it('bounds running recognitions and permits new work after completion', async () => {
    let entered = 0,
      markStarted!: () => void,
      release!: () => void;
    const started = new Promise<void>((r) => {
      markStarted = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const upstream = jest
      .spyOn(global, 'fetch')
      .mockImplementation(async () => {
        entered++;
        if (entered === 2) markStarted();
        await gate;
        return new Response(
          JSON.stringify({
            candidates: [
              {
                finishReason: 'STOP',
                content: { parts: [{ text: JSON.stringify(suggestion) }] },
              },
            ],
          }),
        );
      });
    const first = infer().then((r) => r),
      second = infer().then((r) => r);
    await started;
    const blocked = await infer();
    release();
    expect(blocked.status).toBe(503);
    expect(blocked.body.code).toBe('AI_BUSY');
    expect((await Promise.all([first, second])).map((r) => r.status)).toEqual([
      201, 201,
    ]);
    upstream.mockRestore();
    provider();
    await infer().expect(201);
  });
  it('reports timeouts without holding a recognition slot', async () => {
    const timer = jest
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValueOnce(AbortSignal.abort());
    const upstream = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'));
    expect((await infer().expect(504)).body.code).toBe('AI_TIMEOUT');
    timer.mockRestore();
    upstream.mockRestore();
    provider();
    await infer().expect(201);
  });
});
