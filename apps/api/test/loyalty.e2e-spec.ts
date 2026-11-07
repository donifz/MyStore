import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { LoyaltyService } from '../src/pos/loyalty.service';

describe('buyer loyalty wallet and QR checkout', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  let customerId: string;
  let buyerId: string;
  let variantId: string;
  let shiftId: string;
  const root = `/shops/${fixture.shop}`;

  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE buyer_accounts CASCADE');
    variantId = (
      await request(c.app.getHttpServer())
        .post(root + '/variants')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({
          name: 'Loyalty item',
          barcode: 'LP-' + randomUUID().slice(0, 12),
          salePriceMinor: 15000,
        })
        .expect(201)
    ).body.id;
    await request(c.app.getHttpServer())
      .post(root + '/receivings')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ lines: [{ variantId, quantity: 10, unitCostMinor: 8000 }] })
      .expect(201);
    shiftId = (
      await request(c.app.getHttpServer())
        .post(root + '/pos/shifts')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ openingCashMinor: 0 })
        .expect(201)
    ).body.id;
    customerId = (
      await request(c.app.getHttpServer())
        .post(root + '/customers')
        .auth(c.owner, { type: 'bearer' })
        .send({ name: 'Loyalty Buyer', phone: '+996700000123' })
        .expect(201)
    ).body.id;
    const [buyer] = await c.db.query(
      `INSERT INTO buyer_accounts
       (phone_e164,display_name,password_hash,phone_verified_at)
       VALUES('+996700000123','Loyalty Buyer','hash',now()) RETURNING id`,
    );
    buyerId = buyer.id;
    await c.db.query(
      'UPDATE shop_customers SET buyer_account_id=$3 WHERE shop_id=$1 AND id=$2',
      [fixture.shop, customerId, buyerId],
    );
  });

  afterEach(async () => {
    await teardown(c);
  });

  async function qr() {
    const service = c.app.get(LoyaltyService);
    return (await service.issueQr(buyerId)).token;
  }

  function sell(token: string, redeemPoints = 0, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post(root + '/pos/sales')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({
        shiftId,
        method: 'cash',
        loyaltyToken: token,
        redeemPoints,
        lines: [{ variantId, quantity: 2, expectedUnitPriceMinor: 15000 }],
      });
  }

  it('does not issue or redeem loyalty QR for an unverified buyer', async () => {
    const token = await qr();
    await c.db.query(
      'UPDATE buyer_accounts SET phone_verified_at=NULL WHERE id=$1',
      [buyerId],
    );
    await expect(qr()).rejects.toThrow(
      'Для бонусной карты подтвердите телефон',
    );
    await sell(token).expect(409);
  });

  it('earns points on a paid sale and redeems them once with actual cash', async () => {
    const first = await sell(await qr()).expect(201);
    expect(first.body.totalMinor).toBe(30000);
    expect(first.body.loyalty.earnedPoints).toBe(3);
    expect(first.body.loyalty.balancePoints).toBe(3);

    const token = await qr();
    const key = randomUUID();
    const second = await sell(token, 2, key).expect(201);
    expect(second.body.loyalty.spentPoints).toBe(2);
    expect(second.body.loyalty.cashMinor).toBe(29800);
    expect(second.body.loyalty.earnedPoints).toBe(2);
    expect(second.body.loyalty.balancePoints).toBe(3);
    const replay = await sell(token, 2, key).expect(201);
    expect(replay.body).toEqual(second.body);
    await sell(token).expect(409);

    const wallet = await c.db.query(
      'SELECT balance_points FROM loyalty_wallets WHERE shop_id=$1 AND customer_id=$2',
      [fixture.shop, customerId],
    );
    expect(Number(wallet[0].balance_points)).toBe(3);
    const payment = await c.db.query(
      'SELECT amount_minor FROM payment_records WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, second.body.id],
    );
    expect(Number(payment[0].amount_minor)).toBe(29800);
    const ledger = await c.db.query(
      'SELECT kind,points FROM loyalty_ledger WHERE shop_id=$1 AND sale_id=$2',
      [fixture.shop, second.body.id],
    );
    expect(ledger).toHaveLength(2);
    const reports = await request(c.app.getHttpServer())
      .get(root + '/reports/summary')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(reports.body.loyaltyRedeemedMinor).toBe(200);
    expect(reports.body.grossAfterLoyaltyMinor).toBe(
      reports.body.grossProfitMinor - 200,
    );

    const [line] = await c.db.query(
      'SELECT id FROM sale_lines WHERE shop_id=$1 AND document_id=$2',
      [fixture.shop, second.body.id],
    );
    await request(c.app.getHttpServer())
      .post(root + '/pos/returns')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({
        saleId: second.body.id,
        shiftId,
        method: 'cash',
        refundMoney: true,
        reason: 'No bonus reconciliation yet',
        lines: [{ saleLineId: line.id, quantity: 1, condition: 'resellable' }],
      })
      .expect(409);
  });

  it('rejects out-of-limit and unlinked attempts without changing stock', async () => {
    await sell(await qr()).expect(201);
    await c.db.query(
      'UPDATE loyalty_wallets SET balance_points=100 WHERE shop_id=$1 AND customer_id=$2',
      [fixture.shop, customerId],
    );
    await sell(await qr(), 100).expect(400);
    const token = await qr();
    await c.db.query(
      'UPDATE shop_customers SET buyer_account_id=NULL WHERE shop_id=$1 AND id=$2',
      [fixture.shop, customerId],
    );
    await sell(token, 0).expect(403);
    const [stock] = await c.db.query(
      'SELECT physical FROM stock_balances WHERE shop_id=$1 AND variant_id=$2',
      [fixture.shop, variantId],
    );
    expect(Number(stock.physical)).toBe(8);
    const wallets = await c.app.get(LoyaltyService).wallets(buyerId);
    expect(wallets).toEqual([]);
  });
});
