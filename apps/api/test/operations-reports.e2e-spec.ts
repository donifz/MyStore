import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app';
import { fixture, setup, teardown } from './helpers';

describe('reports, notifications, audit and fiscal readiness', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const root = `/shops/${fixture.shop}`;
  const post = (path: string, body: any, key = randomUUID(), token?: string) =>
    request(c.app.getHttpServer())
      .post(root + path)
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);

  beforeEach(async () => {
    c = await setup(createApp);
  });

  afterEach(async () => {
    await teardown(c);
  });

  it('reconciles sales, returns and stock in the owner report and CSV export', async () => {
    const variant = (
      await post('/variants', {
        name: 'Отчётная чашка',
        salePriceMinor: 200,
      }).expect(201)
    ).body.id;
    await post('/receivings', {
      lines: [{ variantId: variant, quantity: 5, unitCostMinor: 100 }],
    }).expect(201);
    const shift = (
      await post('/pos/shifts', { openingCashMinor: 0 }).expect(201)
    ).body.id;
    const sale = (
      await post('/pos/sales', {
        shiftId: shift,
        method: 'cash',
        lines: [
          {
            variantId: variant,
            quantity: 2,
            expectedUnitPriceMinor: 200,
          },
        ],
      }).expect(201)
    ).body.id;
    const [saleLine] = await c.db.query(
      'SELECT id FROM sale_lines WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, sale],
    );
    await post('/pos/returns', {
      saleId: sale,
      shiftId: shift,
      method: 'cash',
      refundMoney: true,
      reason: 'Возврат для отчёта',
      lines: [
        {
          saleLineId: saleLine.id,
          quantity: 1,
          condition: 'resellable',
        },
      ],
    }).expect(201);

    const closedShift = await post('/pos/shifts/' + shift + '/close', {
      actualCashMinor: 200,
    }).expect(201);
    expect(closedShift.body).toMatchObject({
      status: 'closed',
      salesCashMinor: 400,
      refundsCashMinor: 200,
      expectedCashMinor: 200,
      actualCashMinor: 200,
      discrepancyMinor: 0,
    });
    const stock = await request(c.app.getHttpServer())
      .get(root + '/stock/' + variant)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(stock.body).toMatchObject({
      physical: 4,
      reserved: 0,
      stockValueMinor: 400,
    });

    const summary = await request(c.app.getHttpServer())
      .get(root + '/reports/summary')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(summary.body).toMatchObject({
      salesMinor: 400,
      returnsMinor: 200,
      revenueMinor: 200,
      costOfGoodsMinor: 100,
      grossProfitMinor: 100,
      paymentsReceivedMinor: 400,
      paymentsRefundedMinor: 200,
      cashReceivedMinor: 400,
      physicalUnits: 4,
      reservedUnits: 0,
      stockValueMinor: 400,
      lowStockCount: 1,
    });

    await request(c.app.getHttpServer())
      .get(root + '/reports/summary')
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);

    const csv = await request(c.app.getHttpServer())
      .get(root + '/reports/export/products.csv')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Отчётная чашка');

    const audit = await request(c.app.getHttpServer())
      .get(root + '/audit')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(audit.body.some((x: any) => x.entityType === 'stock_document')).toBe(
      true,
    );
    expect(audit.body.some((x: any) => x.entityType === 'payment')).toBe(true);
    await request(c.app.getHttpServer())
      .get(root + '/audit')
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);

    const previousProvider = process.env.KKM_PROVIDER;
    delete process.env.KKM_PROVIDER;
    try {
      const fiscal = await request(c.app.getHttpServer())
        .get(root + '/fiscal/status')
        .auth(c.owner, { type: 'bearer' })
        .expect(200);
      expect(fiscal.body).toMatchObject({
        configured: false,
        productionReady: false,
      });
      await request(c.app.getHttpServer())
        .post(root + '/fiscal/sales/' + sale)
        .auth(c.owner, { type: 'bearer' })
        .expect(409);
    } finally {
      if (previousProvider === undefined) delete process.env.KKM_PROVIDER;
      else process.env.KKM_PROVIDER = previousProvider;
    }
  });

  it('rejects empty receiving, sale and return documents without ledger writes', async () => {
    const initial = await c.db.query(
      "SELECT count(*)::int n FROM stock_documents WHERE shop_id=$1",
      [fixture.shop],
    );
    await post('/receivings', { lines: [] }).expect(400);
    const shift = (
      await post('/pos/shifts', { openingCashMinor: 0 }).expect(201)
    ).body.id;
    await post('/pos/sales', {
      shiftId: shift,
      method: 'cash',
      lines: [],
    }).expect(400);
    await post('/pos/returns', {
      saleId: randomUUID(),
      refundMoney: false,
      reason: 'No items',
      lines: [],
    }).expect(400);
    const final = await c.db.query(
      "SELECT count(*)::int n FROM stock_documents WHERE shop_id=$1",
      [fixture.shop],
    );
    expect(final[0].n).toBe(initial[0].n);
    const payments = await c.db.query(
      "SELECT count(*)::int n FROM payment_records WHERE shop_id=$1",
      [fixture.shop],
    );
    expect(payments[0].n).toBe(0);
  });

  it('creates transactional order notification and outbox event', async () => {
    const orderId = randomUUID();
    await c.db.query(
      `INSERT INTO online_orders(
        id,shop_id,checkout_hash,fingerprint,store_name,name,phone,
        fulfillment,address,comment,total_minor,expires_at
      ) VALUES($1,$2,$3,$4,$5,$6,$7,'pickup','','',$8,now()+interval '30 minutes')`,
      [
        orderId,
        fixture.shop,
        randomUUID(),
        randomUUID(),
        'Test Shop',
        'Покупатель',
        '996700000000',
        500,
      ],
    );

    const notifications = await request(c.app.getHttpServer())
      .get(root + '/notifications')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    const item = notifications.body.find(
      (x: any) => x.entityId === orderId && x.kind === 'order',
    );
    expect(item).toBeDefined();
    expect(item.readAt).toBeNull();

    await request(c.app.getHttpServer())
      .post(root + '/notifications/' + item.id + '/read')
      .auth(c.cashier, { type: 'bearer' })
      .expect(201);
    const [outbox] = await c.db.query(
      "SELECT count(*)::int n FROM outbox_events WHERE shop_id=$1 AND entity_id=$2 AND topic='order.status'",
      [fixture.shop, orderId],
    );
    expect(outbox.n).toBe(1);

    const health = await request(c.app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(health.body).toMatchObject({ ok: true, database: true });
    expect(health.body.outboxPending).toBeGreaterThanOrEqual(1);
  });
});
