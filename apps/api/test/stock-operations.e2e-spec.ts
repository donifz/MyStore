import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('inventory count, writeoff and defective disposal', () => {
  let c: Awaited<ReturnType<typeof setup>>, variant: string;
  const root = `/shops/${fixture.shop}`;
  const post = (path: string, body: any, key = randomUUID(), token?: string) =>
    request(c.app.getHttpServer())
      .post(root + path)
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);
  beforeEach(async () => {
    c = await setup(createApp);
    variant = (
      await post('/variants', { name: 'Чашка', salePriceMinor: 200 }).expect(
        201,
      )
    ).body.id;
    await post('/receivings', {
      lines: [{ variantId: variant, quantity: 5, unitCostMinor: 100 }],
    }).expect(201);
  });
  afterEach(async () => {
    await teardown(c);
  });
  it('posts a counted discrepancy once, rejects stale and reserved counts, and writes off available stock', async () => {
    const count = {
      variantId: variant,
      expectedQuantity: 5,
      countedQuantity: 4,
      unitCostMinor: 100,
      reason: 'Пересчёт',
    };
    await post('/inventory/counts', count, randomUUID(), c.cashier).expect(403);
    const key = randomUUID();
    const result = (await post('/inventory/counts', count, key).expect(201))
      .body;
    expect(result).toMatchObject({ delta: -1, valueMinor: -100 });
    expect(
      (await post('/inventory/counts', count, key).expect(201)).body,
    ).toEqual(result);
    await post('/inventory/counts', count).expect(409);
    const bad = { variantId: variant, quantity: 5, reason: 'Повреждение' };
    await post('/inventory/writeoffs', bad).expect(409);
    const written = (
      await post('/inventory/writeoffs', { ...bad, quantity: 2 }).expect(201)
    ).body;
    expect(written.valueMinor).toBe(200);
    const balance = (
      await request(c.app.getHttpServer())
        .get(root + '/stock/' + variant)
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(balance).toMatchObject({ physical: 2, stockValueMinor: 200 });
    const movements = await c.db.query(
      'SELECT quantity,value_minor FROM stock_movements WHERE document_id IN($1,$2) ORDER BY quantity',
      [result.id, written.id],
    );
    expect(movements).toHaveLength(2);
  });
  it('tracks returned defects separately and disposes them without making stock saleable', async () => {
    const shift = (
      await post('/pos/shifts', { openingCashMinor: 0 }).expect(201)
    ).body.id;
    const sale = (
      await post('/pos/sales', {
        shiftId: shift,
        method: 'cash',
        lines: [
          { variantId: variant, quantity: 1, expectedUnitPriceMinor: 200 },
        ],
      }).expect(201)
    ).body.id;
    const [line] = await c.db.query(
      'SELECT id FROM sale_lines WHERE document_id=$1',
      [sale],
    );
    await post('/pos/returns', {
      saleId: sale,
      shiftId: shift,
      method: 'cash',
      refundMoney: true,
      reason: 'Брак',
      lines: [{ saleLineId: line.id, quantity: 1, condition: 'defective' }],
    }).expect(201);
    const defect = await request(c.app.getHttpServer())
      .get(root + `/inventory/defects/${variant}`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(defect.body).toEqual({ quantity: 1, valueMinor: 100 });
    await post('/inventory/defects/disposals', {
      variantId: variant,
      quantity: 2,
      reason: 'Утилизация',
    }).expect(409);
    await post('/inventory/defects/disposals', {
      variantId: variant,
      quantity: 1,
      reason: 'Утилизация',
    }).expect(201);
    const after = await request(c.app.getHttpServer())
      .get(root + `/inventory/defects/${variant}`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(after.body.quantity).toBe(0);
    const stock = await request(c.app.getHttpServer())
      .get(root + '/stock/' + variant)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(stock.body.physical).toBe(4);
  });
});
