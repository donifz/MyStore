import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { setup, teardown, fixture, approveTestProduct } from './helpers';
describe('photo receiving', () => {
  let c: Awaited<ReturnType<typeof setup>>, photo: string;
  beforeAll(async () => {
    photo =
      'data:image/jpeg;base64,' +
      (
        await sharp({
          create: { width: 8, height: 8, channels: 3, background: '#ff0000' },
        })
          .jpeg()
          .toBuffer()
      ).toString('base64');
  });
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => teardown(c));
  const body = () => ({
    name: 'Товар по фото',
    unitCostMinor: 8000,
    salePriceMinor: 15000,
    quantity: 3,
    photoDataUrl: photo,
    category: 'Посуда',
    description: 'Описание',
  });
  const capture = (b: any, key = randomUUID(), token?: string) =>
    request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants/capture`)
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(b);
  it('suggests barcode product data without modifying stock', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Test cereal',
          brands: 'Test Brand',
          generic_name: 'Grain product',
        },
      }),
    }) as unknown as typeof fetch;
    try {
      const response = await request(c.app.getHttpServer())
        .get(
          `/shops/${fixture.shop}/variants/barcode-suggestion?code=1234567890123`,
        )
        .auth(c.owner, { type: 'bearer' })
        .expect(200);
      expect(response.body).toMatchObject({
        found: true,
        source: 'openfoodfacts',
        name: 'Test cereal',
        brand: 'Test Brand',
      });
      const [stock] = await c.db.query(
        'SELECT count(*)::int n FROM stock_documents',
      );
      expect(stock.n).toBe(0);
    } finally {
      global.fetch = originalFetch;
    }
  });
  it('creates codes, image, receipt and stock atomically and retries exactly once', async () => {
    const key = randomUUID(),
      a = (await capture(body(), key).expect(201)).body,
      b = (await capture(body(), key).expect(201)).body;
    expect(b).toEqual(a);
    expect(a.sku).toMatch(/^MS-\d{8,}$/);
    expect(a.barcode).toMatch(/^MS[0-9A-F]{24}$/);
    expect(a.receivingId).toBeDefined();
    expect(a.photoUrl).toBe(
      `/api/shops/${fixture.shop}/variants/${a.id}/photo`,
    );
    const stock = (
      await request(c.app.getHttpServer())
        .get(`/shops/${fixture.shop}/stock/${a.id}`)
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(stock).toEqual({
      physical: 3,
      reserved: 0,
      available: 3,
      stockValueMinor: 24000,
    });
    const [n] = await c.db.query('SELECT count(*)::int n FROM stock_documents');
    expect(n.n).toBe(1);
    await capture({ ...body(), name: 'Другой' }, key).expect(409);
    const image = await request(c.app.getHttpServer())
      .get(a.photoUrl.replace('/api', ''))
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect(image.body.length).toBeGreaterThan(10);
  });
  it('rejects corrupt image and money overflow without leaving a product or stock', async () => {
    await capture({
      ...body(),
      photoDataUrl:
        'data:image/jpeg;base64,' +
        Buffer.from('not a photo').toString('base64'),
    }).expect(400);
    await capture({
      ...body(),
      quantity: 2,
      unitCostMinor: Number.MAX_SAFE_INTEGER,
    }).expect(400);
    const [n] = await c.db.query('SELECT count(*)::int n FROM variants');
    expect(n.n).toBe(0);
    const [d] = await c.db.query('SELECT count(*)::int n FROM stock_documents');
    expect(d.n).toBe(0);
  });
  it('guards capture and images by role, tenant and publication without exposing purchase cost', async () => {
    await capture(body(), randomUUID(), c.cashier).expect(403);
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.otherShop}/variants/capture`)
      .auth(c.owner, { type: 'bearer' })
      .set('idempotency-key', randomUUID())
      .send(body())
      .expect(403);
    const a = (await capture(body()).expect(201)).body;
    const [shop] = await c.db.query('SELECT slug FROM shops WHERE id=$1', [
      fixture.shop,
    ]);
    const url = `/public/stores/${shop.slug}/products/${a.id}/photo`;
    await request(c.app.getHttpServer()).get(url).expect(404);
    await c.db.query('UPDATE shops SET published=true WHERE id=$1', [
      fixture.shop,
    ]);
    await approveTestProduct(c.db, a.id);
    await request(c.app.getHttpServer()).get(url).expect(200);
    const product = (
      await request(c.app.getHttpServer())
        .get(url.replace('/photo', ''))
        .expect(200)
    ).body;
    expect(product.photoUrl).toBe('/api' + url);
    expect(product.unitCostMinor).toBeUndefined();
    expect(product.stockValueMinor).toBeUndefined();
    expect(product.photoDataUrl).toBeUndefined();
    await c.db.query('UPDATE variants SET published=false WHERE id=$1', [a.id]);
    await request(c.app.getHttpServer()).get(url).expect(404);
    await request(c.app.getHttpServer()).get(a.photoUrl).expect(401);
  });
  it('keeps generated articles unique beyond eight digits for ordinary creation', async () => {
    await c.db.query("SELECT setval('variant_sku_seq',100000000)");
    const r = await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Обычный товар', salePriceMinor: 100 })
      .expect(201);
    expect(r.body.sku).toBe('MS-100000001');
  });
});
