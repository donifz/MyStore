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

  it('allows an unverified customer without owner approval or credit limit', async () => {
    const [customerBefore] = await c.db.query(
      'SELECT buyer_account_id,credit_approved,credit_limit_minor FROM shop_customers WHERE shop_id=$1 AND id=$2',
      [fixture.shop, customerId],
    );
    expect(customerBefore.buyer_account_id).toBeNull();
    expect(customerBefore.credit_approved).toBe(false);
    expect(Number(customerBefore.credit_limit_minor)).toBe(0);

    const response = await sell(5000).expect(201);
    expect(response.body.customerId).toBe(customerId);
    expect(response.body.paidMinor).toBe(5000);
    expect(response.body.debtMinor).toBe(25000);
  });

  it('does not require credit approval for a linked buyer either', async () => {
    const [{ id }] = await c.db.query(
      `INSERT INTO buyer_accounts(phone_e164,display_name,password_hash)
       VALUES('+996700123456','Credit Buyer','fixture-hash') RETURNING id`,
    );
    await c.db.query(
      'UPDATE shop_customers SET buyer_account_id=$3 WHERE shop_id=$1 AND id=$2',
      [fixture.shop, customerId, id],
    );
    const response = await sell(0).expect(201);
    expect(response.body.debtMinor).toBe(30000);
  });

  it('atomically posts stock, only immediate cash and debt; replay is safe', async () => {
    const key = randomUUID();
    const a = await sell(5000, key).expect(201);
    const b = await sell(5000, key).expect(201);
    expect(b.body).toEqual(a.body);
    expect(a.body.totalMinor).toBe(30000);
    expect(a.body.paidMinor).toBe(5000);
    expect(a.body.debtMinor).toBe(25000);

    const payments = await c.db.query(
      'SELECT amount_minor,method FROM payment_records WHERE shop_id=$1 AND document_id=$2',
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
    const response = await sell(0).expect(201);
    expect(response.body.debtMinor).toBe(30000);
    const [row] = await c.db.query(
      'SELECT count(*)::int AS count FROM payment_records WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, response.body.id],
    );
    expect(row.count).toBe(0);
  });

  it('accepts partial and full repayments without fake product sales', async () => {
    const created = await sell(5000).expect(201);
    const path = shop + '/pos/credit-sales/' + created.body.id + '/repayments';
    const key = randomUUID();
    const first = await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ shiftId, method: 'cash', amountMinor: 10000 })
      .expect(201);
    expect(first.body.debtMinor).toBe(15000);
    const replay = await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ shiftId, method: 'cash', amountMinor: 10000 })
      .expect(201);
    expect(replay.body).toEqual(first.body);
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'card', amountMinor: 15000 })
      .expect(201);
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'cash', amountMinor: 1 })
      .expect(409);
    const [credit] = await c.db.query(
      'SELECT paid_minor,total_minor FROM credit_sales WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, created.body.id],
    );
    expect(Number(credit.paid_minor)).toBe(30000);
    expect(Number(credit.total_minor)).toBe(30000);
    const history = await request(c.app.getHttpServer())
      .get(path)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(history.body).toHaveLength(2);
    const [pay] = await c.db.query(
      'SELECT count(*)::int AS count FROM payment_records WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, created.body.id],
    );
    expect(pay.count).toBe(1);
    const [stockRows] = await c.db.query(
      'SELECT physical FROM stock_balances WHERE shop_id=$1 AND variant_id=$2',
      [fixture.shop, variantId],
    );
    expect(Number(stockRows.physical)).toBe(8);
    const shift = await request(c.app.getHttpServer())
      .get(shop + '/pos/shifts/current')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(shift.body.expectedCashMinor).toBe(16000);
    expect(shift.body.repaymentsCashMinor).toBe(10000);
    expect(shift.body.repaymentsCardMinor).toBe(15000);
    const summary = await request(c.app.getHttpServer())
      .get(shop + '/reports/summary')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(summary.body.creditRepaymentsMinor).toBe(25000);
    expect(summary.body.outstandingCreditMinor).toBe(0);
    expect(summary.body.paymentsReceivedMinor).toBe(30000);
    expect(summary.body.cashReceivedMinor).toBe(15000);
    expect(summary.body.cardReceivedMinor).toBe(15000);
  });

  it('refuses overpayment, missing shop access and closed shifts', async () => {
    const created = await sell(5000).expect(201);
    const path = shop + '/pos/credit-sales/' + created.body.id + '/repayments';
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'cash', amountMinor: 25001 })
      .expect(409);
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'cash', amountMinor: 0 })
      .expect(400);
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'cash', amountMinor: 100 })
      .expect(201);
    await request(c.app.getHttpServer())
      .get(
        `/shops/${fixture.otherShop}/pos/credit-sales/${created.body.id}/repayments`,
      )
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    const [count] = await c.db.query(
      'SELECT count(*)::int AS n FROM credit_repayments WHERE shop_id=$1 AND sale_id=$2',
      [fixture.shop, created.body.id],
    );
    expect(count.n).toBe(1);
  });

  it('does not expose repayments to another buyer by guessing a sale id', async () => {
    const created = await sell(0).expect(201);
    const path = shop + '/pos/credit-sales/' + created.body.id + '/repayments';
    await request(c.app.getHttpServer())
      .post(path)
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ shiftId, method: 'cash', amountMinor: 5000 })
      .expect(201);
    await request(c.app.getHttpServer())
      .post('/buyer/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        name: 'Unrelated Buyer',
        phone: '+996555999888',
        password: 'unrelated-buyer-password',
      })
      .expect(201);
    const agent = request.agent(c.app.getHttpServer());
    await agent
      .post('/buyer/login')
      .set('Origin', 'http://localhost:5173')
      .send({ phone: '+996555999888', password: 'unrelated-buyer-password' })
      .expect(201);
    expect((await agent.get('/buyer/repayments').expect(200)).body).toEqual([]);
    expect((await agent.get('/buyer/debts').expect(200)).body).toEqual([]);
    await agent.get(path).expect(401);
  });

  it('rejects overpayment and prevents unsafe refund on credit sale', async () => {
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
