import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { randomUUID } from 'node:crypto';
describe('sales', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(createApp);
  });
  afterAll(async () => teardown(ctx));
  const sell = (lines: any[], key = randomUUID(), token?: string) =>
    request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/sales`)
      .set('Authorization', `Bearer ${token ?? ctx.cashier}`)
      .set('Idempotency-Key', key)
      .send({ lines });
  async function stocked(qty: number, price = 15000, cost = 10000) {
    const v = (
      await request(ctx.app.getHttpServer())
        .post(`/shops/${fixture.shop}/variants`)
        .set('Authorization', `Bearer ${ctx.owner}`)
        .send({ name: 'Product', salePriceMinor: price })
        .expect(201)
    ).body;
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        lines: [{ variantId: v.id, quantity: qty, unitCostMinor: cost }],
      })
      .expect(201);
    return v.id as string;
  }
  const balance = (id: string) =>
    request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${id}`)
      .set('Authorization', `Bearer ${ctx.owner}`);
  test('sale decreases physical stock and replay keeps original result', async () => {
    const id = await stocked(10),
      key = randomUUID(),
      lines = [{ variantId: id, quantity: 2, expectedUnitPriceMinor: 15000 }];
    const a = await sell(lines, key).expect(201),
      b = await sell(lines, key).expect(201);
    expect(a.body.id).toBe(b.body.id);
    expect(a.body.totalMinor).toBe(30000);
    expect(a.body).not.toHaveProperty('costMinor');
    expect((await balance(id)).body).toMatchObject({
      physical: 8,
      reserved: 0,
      available: 8,
      stockValueMinor: 80000,
    });
  });
  test('reserved stock cannot be sold', async () => {
    const id = await stocked(3);
    await ctx.db.query(
      'UPDATE stock_balances SET reserved=3 WHERE shop_id=$1 AND variant_id=$2',
      [fixture.shop, id],
    );
    await sell([
      { variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 },
    ]).expect(409);
    expect((await balance(id)).body.physical).toBe(3);
  });
  test('concurrent last item has one winner', async () => {
    const id = await stocked(1);
    const responses = await Promise.all([
      sell([{ variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 }]),
      sell([{ variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 }]),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await balance(id)).body.physical).toBe(0);
  });
  test('concurrent identical key makes one sale', async () => {
    const id = await stocked(2),
      key = randomUUID();
    const responses = await Promise.all([
      sell(
        [{ variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 }],
        key,
      ),
      sell(
        [{ variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 }],
        key,
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([201, 201]);
    expect(responses[0].body.id).toBe(responses[1].body.id);
    expect((await balance(id)).body.physical).toBe(1);
  });
  test('same key different payload conflicts', async () => {
    const id = await stocked(3),
      key = randomUUID();
    await sell(
      [{ variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 }],
      key,
    ).expect(201);
    await sell(
      [{ variantId: id, quantity: 2, expectedUnitPriceMinor: 15000 }],
      key,
    ).expect(409);
  });
  test('price change requires confirmation', async () => {
    const id = await stocked(1);
    await sell([
      { variantId: id, quantity: 1, expectedUnitPriceMinor: 14999 },
    ]).expect(409);
    expect((await balance(id)).body.physical).toBe(1);
  });
  test('invalid quantity and overflow leave stock unchanged', async () => {
    const id = await stocked(2, Number.MAX_SAFE_INTEGER, 0);
    await sell([
      {
        variantId: id,
        quantity: 1.5,
        expectedUnitPriceMinor: Number.MAX_SAFE_INTEGER,
      },
    ]).expect(400);
    await sell([
      {
        variantId: id,
        quantity: 2,
        expectedUnitPriceMinor: Number.MAX_SAFE_INTEGER,
      },
    ]).expect(400);
    expect((await balance(id)).body.physical).toBe(2);
  });
  test('missing later variant rolls back all lines', async () => {
    const id = await stocked(2);
    await sell([
      { variantId: id, quantity: 1, expectedUnitPriceMinor: 15000 },
      { variantId: randomUUID(), quantity: 1, expectedUnitPriceMinor: 100 },
    ]).expect(404);
    expect((await balance(id)).body.physical).toBe(2);
  });
  test('weighted cost snapshot stays after later receiving', async () => {
    const id = await stocked(3, 200, 100);
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ variantId: id, quantity: 1, unitCostMinor: 200 }] })
      .expect(201);
    const sale = await sell([
      { variantId: id, quantity: 2, expectedUnitPriceMinor: 200 },
    ]).expect(201);
    const [snapshot] = await ctx.db.query(
      'SELECT cost_minor FROM sale_lines WHERE document_id=$1',
      [sale.body.id],
    );
    expect(Number(snapshot.cost_minor)).toBe(250);
    expect((await balance(id)).body.stockValueMinor).toBe(250);
  });
  test('cashier cannot sell another shop stock', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.otherShop}/sales`)
      .set('Authorization', `Bearer ${ctx.cashier}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        lines: [
          { variantId: randomUUID(), quantity: 1, expectedUnitPriceMinor: 100 },
        ],
      })
      .expect(403);
  });
  test('shop UUID case aliases serialize identical operation keys', async () => {
    const shop = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    await ctx.db.query('INSERT INTO shops(id,name)VALUES($1,$2)', [
      shop,
      'Alias Shop',
    ]);
    await ctx.db.query(
      "INSERT INTO memberships(shop_id,user_id,role)VALUES($1,$2,'owner')",
      [shop, fixture.owner],
    );
    const v = (
      await request(ctx.app.getHttpServer())
        .post(`/shops/${shop}/variants`)
        .set('Authorization', `Bearer ${ctx.owner}`)
        .send({ name: 'Alias Stock', salePriceMinor: 100 })
        .expect(201)
    ).body;
    const key = randomUUID(),
      body = { lines: [{ variantId: v.id, quantity: 1, unitCostMinor: 100 }] };
    const send = (shopId: string) =>
      request(ctx.app.getHttpServer())
        .post(`/shops/${shopId}/receivings`)
        .set('Authorization', `Bearer ${ctx.owner}`)
        .set('Idempotency-Key', key)
        .send(body);
    const results = await Promise.all([send(shop), send(shop.toUpperCase())]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(results[0].body.id).toBe(results[1].body.id);
  });
});
