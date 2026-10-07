import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('atomic POS sales', () => {
  let c: Awaited<ReturnType<typeof setup>>, v: string, shift: string;
  const root = `/shops/${fixture.shop}`;
  beforeEach(async () => {
    c = await setup(createApp);
    v = (
      await request(c.app.getHttpServer())
        .post(root + '/variants')
        .auth(c.owner, { type: 'bearer' })
        .send({ name: 'Bag', barcode: '00123', salePriceMinor: 15000 })
        .expect(201)
    ).body.id;
    await request(c.app.getHttpServer())
      .post(root + '/receivings')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ variantId: v, quantity: 10, unitCostMinor: 10000 }] })
      .expect(201);
    shift = (
      await request(c.app.getHttpServer())
        .post(root + '/pos/shifts')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ openingCashMinor: 1000 })
        .expect(201)
    ).body.id;
  });
  afterEach(async () => {
    await teardown(c);
  });
  function sell(q = 2, method = 'cash', key = randomUUID(), token?: string) {
    return request(c.app.getHttpServer())
      .post(root + '/pos/sales')
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({
        shiftId: shift,
        method,
        lines: [{ variantId: v, quantity: q, expectedUnitPriceMinor: 15000 }],
      });
  }
  it('posts one stock sale and payment on replay', async () => {
    const key = randomUUID();
    const a = await sell(2, 'cash', key).expect(201);
    const b = await sell(2, 'cash', key).expect(201);
    expect(b.body).toEqual(a.body);
    const stock = await request(c.app.getHttpServer())
      .get(root + '/stock/' + v)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(stock.body.physical).toBe(8);
    expect(
      (await c.db.query('SELECT count(*) FROM payment_records'))[0].count,
    ).toBe('1');
    const current = await request(c.app.getHttpServer())
      .get(root + '/pos/shifts/current')
      .auth(c.owner, { type: 'bearer' });
    expect(current.body.expectedCashMinor).toBe(31000);
    expect(current.body.salesCashMinor).toBe(30000);
    expect(current.body.salesCardMinor).toBe(0);
    const detail = await request(c.app.getHttpServer())
      .get(root + '/pos/sales/' + a.body.id)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(detail.body.lines[0].returnedQuantity).toBe(0);
    expect(detail.body.lines[0]).not.toHaveProperty('costMinor');
  });
  it('card does not increase cash; чужая and closed shifts rejected', async () => {
    await sell(1, 'card').expect(201);
    expect(
      (
        await request(c.app.getHttpServer())
          .get(root + '/pos/shifts/current')
          .auth(c.owner, { type: 'bearer' })
      ).body.expectedCashMinor,
    ).toBe(1000);
    await sell(1, 'cash', randomUUID(), c.cashier).expect(403);
    await request(c.app.getHttpServer())
      .post(root + '/pos/shifts/' + shift + '/close')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ actualCashMinor: 1000 })
      .expect(201);
    await sell(1).expect(409);
  });
  it('rolls stock back if payment insertion fails', async () => {
    await c.db.query(
      "CREATE FUNCTION test_fail_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'payment fail'; END $$;CREATE TRIGGER fail_payment BEFORE INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION test_fail_payment()",
    );
    try {
      await sell().expect(500);
      expect(
        (
          await c.db.query(
            'SELECT physical FROM stock_balances WHERE variant_id=$1',
            [v],
          )
        )[0].physical,
      ).toBe('10');
      expect(
        (await c.db.query('SELECT count(*) FROM pos_sales'))[0].count,
      ).toBe('0');
    } finally {
      await c.db.query(
        'DROP TRIGGER fail_payment ON payment_records;DROP FUNCTION test_fail_payment()',
      );
    }
  });
  it('concurrent last-unit sales allow one success', async () => {
    await c.db.query(
      'UPDATE stock_balances SET physical=1,stock_value_minor=10000 WHERE variant_id=$1',
      [v],
    );
    const r = await Promise.all([sell(1), sell(1)]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
  });
  it('close races sale without accepting payments after close', async () => {
    const close = request(c.app.getHttpServer())
      .post(root + '/pos/shifts/' + shift + '/close')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ actualCashMinor: 1000, comment: 'race' });
    const [sale, closed] = await Promise.all([sell(1), close]);
    expect(closed.status).toBe(201);
    expect([201, 409]).toContain(sale.status);
    expect(
      (
        await c.db.query(
          'SELECT count(*) FROM payment_records p JOIN cash_shifts s ON s.id=p.shift_id WHERE p.created_at>s.closed_at',
        )
      )[0].count,
    ).toBe('0');
  });
});
