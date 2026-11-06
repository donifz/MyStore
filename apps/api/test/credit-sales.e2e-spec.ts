import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('POS credit sales accounting', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  let variantId: string;
  let shiftId: string;
  let customerId: string;
  const shop = `/shops/${fixture.shop}`;
  const dueOn = '2099-12-31';

  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE buyer_accounts CASCADE');
    variantId = (
      await request(c.app.getHttpServer())
        .post(shop + '/variants')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Credit Test', barcode: 'CR-001', salePriceMinor: 15000 })
        .expect(201)
    ).body.id;
    await request(c.app.getHttpServer())
      .post(shop + '/receivings')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ variantId, quantity: 10, unitCostMinor: 9000 }] })
      .expect(201);
    shiftId = (
      await request(c.app.getHttpServer())
        .post(shop + '/pos/shifts')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ openingCashMinor: 1000 })
        .expect(201)
    ).body.id;
    customerId = (
      await request(c.app.getHttpServer())
        .post(shop + '/customers')
        .auth(c.owner, { type: 'bearer' })
        .send({ name: 'Credit Buyer', phone: '0700 123 456' })
        .expect(201)
    ).body.id;
    const [{ id }] = await c.db.query(
      `INSERT INTO buyer_accounts(phone_e164,display_name,password_hash)
       VALUES('+996700123456','Credit Buyer','fixture-hash') RETURNING id`,
    );
    await c.db.query(
      'UPDATE shop_customers SET buyer_account_id=$3 WHERE shop_id=$1 AND id=$2',
      [fixture.shop, customerId, id],
    );
  });
  afterEach(async () => {
    await teardown(c);
  });

  function sell(paidMinor: number, key = randomUUID(), customer = customerId) {
    return request(c.app.getHttpServer())
      .post(shop + '/pos/credit-sales')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({
        shiftId,
        customerId: customer,
        method: 'cash',
        paidMinor,
        dueOn,
        lines: [{ variantId, quantity: 2, expectedUnitPriceMinor: 15000 }],
      });
  }

  it('requires owner credit approval and enforces customer limit', async () => {
    await sell(5000).expect(409);
    await request(c.app.getHttpServer())
      .post(shop + '/customers/' + customerId + '/credit-policy')
      .auth(c.cashier, { type: 'bearer' })
      .send({ approved: true, limitMinor: 100000 })
      .expect(403);
    await request(c.app.getHttpServer())
      .post(shop + '/customers/' + customerId + '/credit-policy')
      .auth(c.owner, { type: 'bearer' })
      .send({ approved: true, limitMinor: 20000 })
      .expect(201);
    await sell(5000).expect(409);
  });

  it('atomically posts stock, only immediate cash and debt; replay is safe', async () => {
    await request(c.app.getHttpServer())
      .post(shop + '/customers/' + customerId + '/credit-policy')
      .auth(c.owner, { type: 'bearer' })
      .send({ approved: true, limitMinor: 100000 })
      .expect(201);
    const key = randomUUID();
    const a = await sell(5000, key).expect(201);
    const b = await sell(5000, key).expect(201);
    expect(b.body).toEqual(a.body);
    expect(a.body.totalMinor).toBe(30000);
    expect(a.body.paidMinor).toBe(5000);
    expect(a.body.debtMinor).toBe(25000);

    const payments = await c.db.query(
      "SELECT amount_minor,method FROM payment_records WHERE shop_id=$1 AND document_id=$2",
      [fixture.shop, a.body.id],
    );
    expect(payments).toHaveLength(1);
    expect(Number(payments[0].amount_minor)).toBe(5000);
    const history = await request(c.app.getHttpServer())
      .get(shop + '/pos/credit-sales?customerId=' + customerId)
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].debtMinor).toBe(25000);

    const cash = await request(c.app.getHttpServer())
      .get(shop + '/pos/shifts/current')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(cash.body.expectedCashMinor).toBe(6000);
    const stock = await request(c.app.getHttpServer())
      .get(shop + '/stock/' + variantId)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(stock.body.physical).toBe(8);
  });

  it('records zero upfront payment without fabricated payment record', async () => {
    await request(c.app.getHttpServer())
      .post(shop + '/customers/' + customerId + '/credit-policy')
      .auth(c.owner, { type: 'bearer' })
      .send({ approved: true, limitMinor: 100000 })
      .expect(201);
    const response = await sell(0).expect(201);
    expect(response.body.debtMinor).toBe(30000);
    const [row] = await c.db.query(
      'SELECT count(*)::int AS count FROM payment_records WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, response.body.id],
    );
    expect(row.count).toBe(0);
  });

  it('rejects overpayment and prevents unsafe refund on credit sale', async () => {
    await request(c.app.getHttpServer())
      .post(shop + '/customers/' + customerId + '/credit-policy')
      .auth(c.owner, { type: 'bearer' })
      .send({ approved: true, limitMinor: 100000 })
      .expect(201);
    await sell(30000).expect(400);
    const created = await sell(5000).expect(201);
    const [line] = await c.db.query(
      'SELECT id FROM sale_lines WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, created.body.id],
    );
    await request(c.app.getHttpServer())
      .post(shop + '/pos/returns')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        saleId: created.body.id,
        shiftId,
        method: 'cash',
        refundMoney: true,
        reason: 'test credit return',
        lines: [{ saleLineId: line.id, quantity: 1, condition: 'resellable' }],
      })
      .expect(409);
  });
});
