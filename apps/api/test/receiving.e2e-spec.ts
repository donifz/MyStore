import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { randomUUID } from 'node:crypto';
describe('receiving', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let id: string;
  beforeAll(async () => {
    ctx = await setup(createApp);
    const r = await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Bag', barcode: 'BAG', salePriceMinor: 15000 })
      .expect(201);
    id = r.body.id;
  });
  afterAll(async () => teardown(ctx));
  const receive = (lines: any[], key = randomUUID(), token?: string) =>
    request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${token ?? ctx.owner}`)
      .set('Idempotency-Key', key)
      .send({ lines });
  const balance = () =>
    request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${id}`)
      .set('Authorization', `Bearer ${ctx.owner}`);
  test('receives ten items atomically and replay does not duplicate', async () => {
    const key = randomUUID(),
      lines = [{ variantId: id, quantity: 10, unitCostMinor: 10000 }];
    const a = await receive(lines, key).expect(201),
      b = await receive(lines, key).expect(201);
    expect(a.body.id).toBe(b.body.id);
    const r = await balance().expect(200);
    expect(r.body).toMatchObject({
      physical: 10,
      reserved: 0,
      available: 10,
      stockValueMinor: 100000,
    });
    const rows = await ctx.db.query(
      'SELECT count(*)::int AS n FROM stock_movements',
    );
    expect(rows[0].n).toBe(1);
  });
  test('same key with different content is conflict', async () => {
    const key = randomUUID();
    await receive(
      [{ variantId: id, quantity: 1, unitCostMinor: 10000 }],
      key,
    ).expect(201);
    await receive(
      [{ variantId: id, quantity: 2, unitCostMinor: 10000 }],
      key,
    ).expect(409);
  });
  test.each([0, 1.5, -1])(
    'invalid quantity %s does not mutate stock',
    async (quantity) => {
      const before = (await balance()).body;
      await receive([{ variantId: id, quantity, unitCostMinor: 10000 }]).expect(
        400,
      );
      expect((await balance()).body).toEqual(before);
    },
  );
  test('overflow is rejected before writing', async () => {
    const before = (await balance()).body;
    await receive([
      { variantId: id, quantity: 2, unitCostMinor: Number.MAX_SAFE_INTEGER },
    ]).expect(400);
    expect((await balance()).body).toEqual(before);
  });
  test('unknown second variant rolls back whole receipt', async () => {
    const before = (await balance()).body;
    await receive([
      { variantId: id, quantity: 2, unitCostMinor: 10000 },
      { variantId: randomUUID(), quantity: 1, unitCostMinor: 10000 },
    ]).expect(404);
    expect((await balance()).body).toEqual(before);
  });
  test('foreign variant rolls back whole receipt', async () => {
    const foreign = randomUUID();
    await ctx.db.query(
      'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor)VALUES($1,$2,$3,$4,100)',
      [foreign, fixture.otherShop, 'Foreign', 'FOREIGN'],
    );
    const before = (await balance()).body;
    await receive([
      { variantId: id, quantity: 1, unitCostMinor: 10000 },
      { variantId: foreign, quantity: 1, unitCostMinor: 100 },
    ]).expect(404);
    expect((await balance()).body).toEqual(before);
  });
  test('cashier cannot receive or read cost', async () => {
    await receive(
      [{ variantId: id, quantity: 1, unitCostMinor: 100 }],
      randomUUID(),
      ctx.cashier,
    ).expect(403);
    const r = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${id}`)
      .set('Authorization', `Bearer ${ctx.cashier}`)
      .expect(200);
    expect(r.body).not.toHaveProperty('stockValueMinor');
  });
  test('duplicate variant lines and missing key are invalid', async () => {
    const line = { variantId: id, quantity: 1, unitCostMinor: 100 };
    await receive([line, line]).expect(400);
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .send({ lines: [line] })
      .expect(400);
  });
  test('movement cannot be edited', async () => {
    await expect(
      ctx.db.query('UPDATE stock_movements SET quantity=0'),
    ).rejects.toThrow();
    await expect(ctx.db.query('DELETE FROM stock_movements')).rejects.toThrow();
  });
  test('UUID case aliases cannot duplicate a receiving line', async () => {
    const alias = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await ctx.db.query(
      'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor)VALUES($1,$2,$3,$4,100)',
      [alias, fixture.shop, 'Alias', 'ALIAS'],
    );
    await receive([
      { variantId: alias, quantity: 1, unitCostMinor: 100 },
      { variantId: alias.toUpperCase(), quantity: 1, unitCostMinor: 100 },
    ]).expect(400);
    const result = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${alias}`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(200);
    expect(result.body.physical).toBe(0);
  });
  test('later stock limit failure rolls back earlier writes and document', async () => {
    const first = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const last = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    await ctx.db.query(
      'INSERT INTO variants(id,shop_id,name,barcode,sale_price_minor)VALUES($1,$3,$4,$5,100),($2,$3,$4,$6,100)',
      [first, last, fixture.shop, 'Limit test', 'LIMIT-FIRST', 'LIMIT-LAST'],
    );
    await ctx.db.query(
      'INSERT INTO stock_balances(shop_id,variant_id,physical)VALUES($1,$2,1000000000)',
      [fixture.shop, last],
    );
    const snapshot = async () => ({
      documents: (
        await ctx.db.query('SELECT count(*)::int AS n FROM stock_documents')
      )[0].n,
      movements: (
        await ctx.db.query('SELECT count(*)::int AS n FROM stock_movements')
      )[0].n,
      results: (
        await ctx.db.query('SELECT count(*)::int AS n FROM operation_results')
      )[0].n,
    });
    const before = await snapshot();
    await receive([
      { variantId: first, quantity: 1, unitCostMinor: 100 },
      { variantId: last, quantity: 1, unitCostMinor: 0 },
    ]).expect(400);
    expect(await snapshot()).toEqual(before);
    const firstBalance = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${first}`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(200);
    const lastBalance = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/stock/${last}`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(200);
    expect(firstBalance.body.physical).toBe(0);
    expect(lastBalance.body.physical).toBe(1000000000);
  });
  test('duplicate document number is rejected with 409', async () => {
    const lines = [{ variantId: id, quantity: 1, unitCostMinor: 10000 }];
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({ documentNumber: 'DUP-DOC-01', lines })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/receivings`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({ documentNumber: 'DUP-DOC-01', lines })
      .expect(409);
  });
});
