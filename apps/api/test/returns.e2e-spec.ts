import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('historical returns', () => {
  let c: Awaited<ReturnType<typeof setup>>,
    v: string,
    shift: string,
    sale: string,
    line: string;
  const root = `/shops/${fixture.shop}`;
  function post(path: string, body: any, token?: string, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post(root + path)
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);
  }
  beforeEach(async () => {
    c = await setup(createApp);
    v = (await post('/variants', { name: 'Bag', salePriceMinor: 100 })).body.id;
    await post('/receivings', {
      lines: [{ variantId: v, quantity: 3, unitCostMinor: 33 }],
    }).expect(201);
    await c.db.query(
      'UPDATE stock_balances SET stock_value_minor=100 WHERE variant_id=$1',
      [v],
    );
    shift = (await post('/pos/shifts', { openingCashMinor: 1000 }).expect(201))
      .body.id;
    sale = (
      await post('/pos/sales', {
        shiftId: shift,
        method: 'cash',
        lines: [{ variantId: v, quantity: 3, expectedUnitPriceMinor: 100 }],
      }).expect(201)
    ).body.id;
    line = (
      await c.db.query('SELECT id FROM sale_lines WHERE document_id=$1', [sale])
    )[0].id;
  });
  afterEach(async () => {
    await teardown(c);
  });
  function ret(
    q = 1,
    condition = 'resellable',
    token?: string,
    key = randomUUID(),
  ) {
    return post(
      '/pos/returns',
      {
        saleId: sale,
        shiftId: shift,
        method: 'cash',
        refundMoney: true,
        reason: 'Возврат покупателя',
        lines: [{ saleLineId: line, quantity: q, condition }],
      },
      token,
      key,
    );
  }
  it('restores exact partial historical cost and replays without double refund', async () => {
    const key = randomUUID();
    const a = await ret(1, 'resellable', undefined, key).expect(201);
    await ret(1, 'resellable', undefined, key).expect(201);
    expect(a.body.refundedMinor).toBe(100);
    expect(
      (
        await c.db.query(
          'SELECT stock_value_minor FROM stock_balances WHERE variant_id=$1',
          [v],
        )
      )[0].stock_value_minor,
    ).toBe('33');
    await post('/receivings', {
      lines: [{ variantId: v, quantity: 1, unitCostMinor: 1000 }],
    }).expect(201);
    await ret().expect(201);
    expect(
      (
        await c.db.query(
          'SELECT stock_value_minor FROM stock_balances WHERE variant_id=$1',
          [v],
        )
      )[0].stock_value_minor,
    ).toBe('1067');
    await ret().expect(201);
    expect(
      (
        await c.db.query(
          'SELECT stock_value_minor FROM stock_balances WHERE variant_id=$1',
          [v],
        )
      )[0].stock_value_minor,
    ).toBe('1100');
    await ret().expect(409);
    const detail = await request(c.app.getHttpServer())
      .get(root + '/pos/sales/' + sale)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(detail.body.lines[0].returnedQuantity).toBe(3);
  });
  it('defect refunds money without making stock available', async () => {
    await ret(1, 'defective').expect(201);
    expect(
      (
        await c.db.query(
          'SELECT physical FROM stock_balances WHERE variant_id=$1',
          [v],
        )
      )[0].physical,
    ).toBe('0');
    expect(
      (
        await request(c.app.getHttpServer())
          .get(root + '/pos/shifts/current')
          .auth(c.owner, { type: 'bearer' })
      ).body.expectedCashMinor,
    ).toBe(1200);
  });
  it('rejects concurrent over-return and cashier or manager access', async () => {
    await ret(2).expect(201);
    const r = await Promise.all([ret(), ret()]);
    expect(r.map((x) => x.status).sort()).toEqual([201, 409]);
    await ret(1, 'resellable', c.cashier).expect(403);
    await c.db.query("UPDATE memberships SET role='manager' WHERE user_id=$1", [
      fixture.cashier,
    ]);
    await ret(1, 'resellable', c.cashier).expect(403);
  });
  it('allows only stock return for legacy sales and validates shop', async () => {
    const old = await post('/sales', {
      lines: [{ variantId: v, quantity: 1, expectedUnitPriceMinor: 100 }],
    });
    expect(old.status).toBe(409);
    await post('/receivings', {
      lines: [{ variantId: v, quantity: 1, unitCostMinor: 50 }],
    }).expect(201);
    const legacy = (
      await post('/sales', {
        lines: [{ variantId: v, quantity: 1, expectedUnitPriceMinor: 100 }],
      }).expect(201)
    ).body.id;
    const legacyLine = (
      await c.db.query('SELECT id FROM sale_lines WHERE document_id=$1', [
        legacy,
      ])
    )[0].id;
    await post('/pos/returns', {
      saleId: legacy,
      shiftId: shift,
      method: 'cash',
      refundMoney: true,
      reason: 'test',
      lines: [{ saleLineId: legacyLine, quantity: 1, condition: 'resellable' }],
    }).expect(409);
    await post('/pos/returns', {
      saleId: legacy,
      refundMoney: false,
      reason: 'test',
      lines: [{ saleLineId: legacyLine, quantity: 1, condition: 'resellable' }],
    }).expect(201);
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.otherShop}/pos/returns`)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        saleId: sale,
        refundMoney: false,
        reason: 'test',
        lines: [{ saleLineId: line, quantity: 1, condition: 'resellable' }],
      })
      .expect(403);
  });
  it('rolls return and stock back on failed refund payment', async () => {
    await c.db.query(
      "CREATE FUNCTION test_return_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='refund' THEN RAISE EXCEPTION 'refund fail';END IF;RETURN NEW;END $$;CREATE TRIGGER fail_refund BEFORE INSERT ON payment_records FOR EACH ROW EXECUTE FUNCTION test_return_fail()",
    );
    try {
      await ret().expect(500);
      expect(
        (
          await c.db.query(
            'SELECT physical FROM stock_balances WHERE variant_id=$1',
            [v],
          )
        )[0].physical,
      ).toBe('0');
      expect(
        (await c.db.query('SELECT count(*) FROM return_lines'))[0].count,
      ).toBe('0');
    } finally {
      await c.db.query(
        'DROP TRIGGER fail_refund ON payment_records;DROP FUNCTION test_return_fail()',
      );
    }
  });
});
