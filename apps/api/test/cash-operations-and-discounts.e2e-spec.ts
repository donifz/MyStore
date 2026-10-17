import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('cash operations and discounts', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  const root = `/shops/${fixture.shop}`;

  beforeAll(async () => {
    ctx = await setup(createApp);
  });

  afterAll(async () => {
    await teardown(ctx);
  });

  const post = (
    path: string,
    body: any,
    token = ctx.owner,
    key = randomUUID(),
  ) =>
    request(ctx.app.getHttpServer())
      .post(root + path)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send(body);

  const get = (path: string, token = ctx.owner) =>
    request(ctx.app.getHttpServer())
      .get(root + path)
      .auth(token, { type: 'bearer' });

  test('cash in and cash out update expected cash without altering sales or inventory', async () => {
    // 1. Open shift with 1000 Som (100000 minor)
    const shiftRes = await post('/pos/shifts', {
      openingCashMinor: 100000,
    }).expect(201);
    const shiftId = shiftRes.body.id;
    expect(shiftRes.body.expectedCashMinor).toBe(100000);
    expect(shiftRes.body.salesCashMinor).toBe(0);

    // 2. Cash In: 500 Som (50000 minor) with reason
    const inKey = randomUUID();
    const inRes = await post(
      `/pos/shifts/${shiftId}/cash-in`,
      { amountMinor: 50000, reason: 'Разменный фонд' },
      ctx.owner,
      inKey,
    ).expect(201);

    expect(inRes.body.type).toBe('in');
    expect(inRes.body.amountMinor).toBe(50000);
    expect(inRes.body.reason).toBe('Разменный фонд');

    // Replay idempotency key
    const replayIn = await post(
      `/pos/shifts/${shiftId}/cash-in`,
      { amountMinor: 50000, reason: 'Разменный фонд' },
      ctx.owner,
      inKey,
    ).expect(201);
    expect(replayIn.body.id).toBe(inRes.body.id);

    // Verify expected cash increased to 150000 minor, but sales remain 0
    const shiftAfterIn = await get(`/pos/shifts/${shiftId}`).expect(200);
    expect(shiftAfterIn.body.expectedCashMinor).toBe(150000);
    expect(shiftAfterIn.body.cashInMinor).toBe(50000);
    expect(shiftAfterIn.body.salesCashMinor).toBe(0);

    // 3. Cash Out: 300 Som (30000 minor)
    const outRes = await post(`/pos/shifts/${shiftId}/cash-out`, {
      amountMinor: 30000,
      reason: 'Оплата хозрасходов',
    }).expect(201);
    expect(outRes.body.type).toBe('out');
    expect(outRes.body.amountMinor).toBe(30000);

    const shiftAfterOut = await get(`/pos/shifts/${shiftId}`).expect(200);
    expect(shiftAfterOut.body.expectedCashMinor).toBe(120000);
    expect(shiftAfterOut.body.cashOutMinor).toBe(30000);

    // 4. Over-withdrawal barrier: attempting to withdraw more than expected cash fails (400)
    const excessiveWithdrawal = await post(`/pos/shifts/${shiftId}/cash-out`, {
      amountMinor: 200000,
      reason: 'Слишком много',
    }).expect(400);
    expect(excessiveWithdrawal.body.message).toContain(
      'exceeds cash in register',
    );

    // Missing reason fails (400)
    await post(`/pos/shifts/${shiftId}/cash-in`, {
      amountMinor: 1000,
      reason: '   ',
    }).expect(400);

    // 5. Query transactions list
    const txList = await get(`/pos/shifts/${shiftId}/transactions`).expect(200);
    expect(txList.body).toHaveLength(2);
    expect(txList.body[0].type).toBe('in');
    expect(txList.body[1].type).toBe('out');

    // Close shift with matching cash
    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 120000,
    }).expect(201);
  });

  test('item discount validation, cashier limits, and historical return calculation', async () => {
    // Create product
    const prodRes = await post('/variants', {
      name: 'Wool Jacket',
      barcode: 'JACKET-001',
      salePriceMinor: 100000, // 1000 Som
    }).expect(201);
    const vId = prodRes.body.id;

    // Receive stock of 5
    await post('/receivings', {
      lines: [{ variantId: vId, quantity: 5, unitCostMinor: 40000 }],
    }).expect(201);

    // Open shift
    const shiftRes = await post('/pos/shifts', { openingCashMinor: 0 }).expect(
      201,
    );
    const shiftId = shiftRes.body.id;

    // 1. Discount without reason is rejected (400)
    await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [
        {
          variantId: vId,
          quantity: 1,
          expectedUnitPriceMinor: 90000,
          discountMinor: 10000,
          // missing discountReason
        },
      ],
    }).expect(400);

    // 2. Discount exceeding price is rejected (400)
    await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [
        {
          variantId: vId,
          quantity: 1,
          expectedUnitPriceMinor: 0,
          discountMinor: 150000,
          discountReason: 'Бесплатно',
        },
      ],
    }).expect(400);

    // 3. Cashier discount exceeding 20% limit is rejected (403)
    // 25% discount (25000 minor) on 100000 minor item by cashier
    await post(
      '/pos/sales',
      {
        shiftId,
        method: 'cash',
        lines: [
          {
            variantId: vId,
            quantity: 1,
            expectedUnitPriceMinor: 75000,
            discountMinor: 25000,
            discountReason: 'Большая скидка от кассира',
          },
        ],
      },
      ctx.cashier,
    ).expect(403);

    // 4. Owner can give 30% discount
    const saleRes = await post('/pos/sales', {
      shiftId,
      method: 'cash',
      lines: [
        {
          variantId: vId,
          quantity: 2,
          expectedUnitPriceMinor: 70000, // 100000 base - 30000 discount
          discountMinor: 30000,
          discountReason: 'Скидка владельца',
        },
      ],
    }).expect(201);

    const saleId = saleRes.body.id;
    // Total should be 2 * 70000 = 140000 minor
    expect(saleRes.body.totalMinor).toBe(140000);

    // 5. Verify sale lines store discount details and actual discounted unit price
    const saleDetail = await get(`/pos/sales/${saleId}`).expect(200);
    expect(saleDetail.body.lines[0].unitPriceMinor).toBe(70000);
    expect(saleDetail.body.lines[0].discountMinor).toBe(30000);
    expect(saleDetail.body.lines[0].discountReason).toBe('Скидка владельца');

    // 6. Return: customer returns 1 unit -> refund must be exactly 70000 minor (discounted price)
    const saleLineId = saleDetail.body.lines[0].id;
    const returnRes = await post('/pos/returns', {
      saleId,
      shiftId,
      method: 'cash',
      refundMoney: true,
      reason: 'Возврат со скидкой',
      lines: [{ saleLineId, quantity: 1, condition: 'resellable' }],
    }).expect(201);

    expect(returnRes.body.refundedMinor).toBe(70000);

    // Check shift expected cash: 0 opening + 140000 sale - 70000 return = 70000 minor
    const currentShift = await get(`/pos/shifts/${shiftId}`).expect(200);
    expect(currentShift.body.expectedCashMinor).toBe(70000);

    // Close shift
    await post(`/pos/shifts/${shiftId}/close`, {
      actualCashMinor: 70000,
    }).expect(201);
  });
});
