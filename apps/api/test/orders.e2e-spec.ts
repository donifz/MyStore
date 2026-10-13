import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture, approveTestProduct } from './helpers';
import { OrdersService } from '../src/orders/orders.service';
import { OrderExpirationService } from '../src/orders/order-expiration.service';

describe('online orders and shared stock', () => {
  let c: Awaited<ReturnType<typeof setup>>, v: any, slug: string;
  const http = () => c.app.getHttpServer();
  const privatePost = (
    path: string,
    body: any,
    token?: string,
    key = randomUUID(),
  ) =>
    request(http())
      .post(`/shops/${fixture.shop}/${path}`)
      .auth(token ?? c.owner, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);
  const checkout = (body: any) =>
    request(http())
      .post('/public/orders')
      .set('origin', 'http://localhost:5173')
      .send(body);
  const receipt = (key: string) =>
    request(http())
      .post('/public/orders/receipt')
      .set('origin', 'http://localhost:5173')
      .send({ checkoutKey: key });
  const input = (quantity = 2) => ({
    checkoutKey: randomUUID(),
    storeSlug: slug,
    name: 'Покупатель',
    phone: '+996 700 123456',
    fulfillment: 'pickup',
    address: '',
    comment: 'Позвоните',
    lines: [{ variantId: v.id, quantity, expectedUnitPriceMinor: 15000 }],
  });
  const balance = async () =>
    (
      await c.db.query(
        'SELECT physical,reserved,stock_value_minor FROM stock_balances WHERE variant_id=$1',
        [v.id],
      )
    )[0];
  const state = (id: string, status: string, token?: string) =>
    privatePost(`orders/${id}/status`, { status }, token);
  async function ready() {
    const body = input(),
      order = (await checkout(body).expect(201)).body;
    await state(order.id, 'confirmed').expect(201);
    await state(order.id, 'ready').expect(201);
    return order;
  }
  beforeEach(async () => {
    c = await setup(createApp);
    const [[s]] = await c.db.query(
      'UPDATE shops SET published=true,city=$2,phone=$3 WHERE id=$1 RETURNING slug',
      [fixture.shop, 'Ош', '+996700123456'],
    );
    slug = s.slug;
    v = (
      await privatePost('variants', {
        name: 'Чашка',
        salePriceMinor: 15000,
      }).expect(201)
    ).body;
    await approveTestProduct(c.db, v.id);
    await privatePost('receivings', {
      lines: [{ variantId: v.id, quantity: 5, unitCostMinor: 8000 }],
    }).expect(201);
  });
  afterEach(async () => teardown(c));

  it('keeps old checkout retries compatible and persists optional email', async () => {
    const legacy = input();
    await checkout(legacy).expect(201);
    await checkout({ ...legacy, email: '' }).expect(201);
    const body = { ...input(1), email: 'buyer@example.test' };
    const order = (await checkout(body).expect(201)).body;
    expect(
      (
        await c.db.query('SELECT email FROM online_orders WHERE id=$1', [
          order.id,
        ])
      )[0].email,
    ).toBe('buyer@example.test');
    await checkout({ ...body, email: 'other@example.test' }).expect(409);
    await checkout({ ...input(1), email: 'invalid' }).expect(400);
  });

  it('reserves, retries exactly once and exposes only a minimal receipt', async () => {
    const body = input();
    const a = (await checkout(body).expect(201)).body;
    const b = (await checkout(body).expect(201)).body;
    expect(b).toEqual(a);
    expect(a).toEqual({
      id: expect.any(String),
      status: 'new',
      totalMinor: 30000,
      expiresAt: expect.any(String),
      storeName: 'Test Shop',
    });
    expect(Date.parse(a.expiresAt) - Date.now()).toBeGreaterThan(
      29 * 60 * 1000,
    );
    expect(await balance()).toEqual({
      physical: '5',
      reserved: '2',
      stock_value_minor: '40000',
    });
    expect((await receipt(body.checkoutKey).expect(201)).body).toEqual(a);
    await checkout({ ...body, name: 'Другой' }).expect(409);
    await receipt(randomUUID()).expect(404);
    const publicProduct = (
      await request(http())
        .get(`/public/stores/${slug}/products/${v.id}`)
        .expect(200)
    ).body;
    expect(publicProduct.available).toBe(3);
  });
  it('serializes competing checkout and POS without overselling', async () => {
    const a = input(4),
      b = input(4);
    b.phone = '+996700222222';
    const results = await Promise.all([
      checkout(a),
      checkout(b),
      privatePost('sales', {
        lines: [
          { variantId: v.id, quantity: 4, expectedUnitPriceMinor: 15000 },
        ],
      }),
    ]);
    expect(results.map((x) => x.status).sort()).toEqual([201, 409, 409]);
    const stock = await balance();
    expect(Number(stock.physical) - Number(stock.reserved)).toBe(1);
  });
  it('rolls back all lines on insufficient stock and rejects duplicate variants', async () => {
    const other = (
      await privatePost('variants', {
        name: 'Нет остатка',
        salePriceMinor: 100,
      }).expect(201)
    ).body;
    await approveTestProduct(c.db, other.id);
    const b = input();
    b.lines.push({
      variantId: other.id,
      quantity: 1,
      expectedUnitPriceMinor: 100,
    });
    await checkout(b).expect(409);
    expect((await balance()).reserved).toBe('0');
    const dup = input();
    dup.lines.push(dup.lines[0]);
    await checkout(dup).expect(400);
  });
  it('rejects hidden shop/products and changed prices with no reservation', async () => {
    await c.db.query('UPDATE variants SET sale_price_minor=16000 WHERE id=$1', [
      v.id,
    ]);
    await checkout(input()).expect(409);
    await c.db.query('UPDATE variants SET published=false WHERE id=$1', [v.id]);
    await checkout(input()).expect(404);
    await c.db.query('UPDATE shops SET published=false WHERE id=$1', [
      fixture.shop,
    ]);
    await checkout(input()).expect(404);
    expect((await balance()).reserved).toBe('0');
  });
  it('validates delivery, contact, money, origin and quantity before writing', async () => {
    await checkout({ ...input(), fulfillment: 'delivery' }).expect(400);
    await checkout({ ...input(), phone: '((((((((' }).expect(400);
    await checkout({ ...input(), name: '   ' }).expect(400);
    await checkout({ ...input(), checkoutKey: 'guessable' }).expect(400);
    const b = input();
    b.lines[0].quantity = 1000001;
    await checkout(b).expect(400);
    const money = input();
    money.lines[0].expectedUnitPriceMinor = Number.MAX_SAFE_INTEGER + 1;
    await checkout(money).expect(400);
    await request(http())
      .post('/public/orders')
      .set('origin', 'https://attacker.test')
      .send(input())
      .expect(403);
    expect((await balance()).reserved).toBe('0');
  });
  it('bounds anonymous reservations per phone', async () => {
    for (let i = 0; i < 3; i++) await checkout(input(1)).expect(201);
    await checkout(input(1)).expect(429);
    expect((await balance()).reserved).toBe('3');
  });
  it('waits for creation paused in expiry instead of returning a missing receipt', async () => {
    const service = c.app.get(OrdersService),
      expiry = c.app.get(OrderExpirationService);
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const spy = jest
      .spyOn(expiry, 'expireForCheckout')
      .mockImplementationOnce(async () => {
        entered();
        await gate;
      });
    const body = input();
    const creating = service.create(body as any);
    await started;
    let settled = false;
    const recovering = service
      .receipt(body.checkoutKey)
      .catch((e) => e)
      .then((r) => {
        settled = true;
        return r;
      });
    await new Promise((r) => setTimeout(r, 100));
    const premature = settled;
    release();
    const [created, recovered] = await Promise.all([creating, recovering]);
    spy.mockRestore();
    expect(premature).toBe(false);
    expect(recovered).toEqual(created);
    expect((await balance()).reserved).toBe('2');
  });
  it('drains an overdue backlog larger than a sweep batch before checkout', async () => {
    await privatePost('receivings', {
      lines: [{ variantId: v.id, quantity: 100, unitCostMinor: 8000 }],
    }).expect(201);
    await c.db.query(
      "INSERT INTO online_orders(id,shop_id,checkout_hash,fingerprint,store_name,name,phone,fulfillment,address,comment,total_minor,expires_at) SELECT gen_random_uuid(),$1,md5(n::text),md5(n::text),'Test Shop','Backlog','996700123456','pickup','','',15000,now()-interval '1 minute' FROM generate_series(1,101) n",
      [fixture.shop],
    );
    await c.db.query(
      'INSERT INTO online_order_lines(shop_id,order_id,variant_id,name,barcode,quantity,unit_price_minor) SELECT shop_id,id,$1,$2,$3,1,15000 FROM online_orders',
      [v.id, v.name, v.barcode],
    );
    await c.db.query(
      'UPDATE stock_balances SET reserved=101 WHERE variant_id=$1',
      [v.id],
    );
    await c.app.get(OrderExpirationService).expire();
    expect((await balance()).reserved).toBe('0');
    await c.db.query(
      "UPDATE online_orders SET status='new',expires_at=now()-interval '1 minute'",
    );
    await c.db.query(
      'UPDATE stock_balances SET reserved=101 WHERE variant_id=$1',
      [v.id],
    );
    expect((await checkout(input(105)).expect(201)).body.totalMinor).toBe(
      1575000,
    );
  });
  it('handles more simultaneous checkouts than pooled database connections', async () => {
    await privatePost('receivings', {
      lines: [{ variantId: v.id, quantity: 10, unitCostMinor: 8000 }],
    }).expect(201);
    const responses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        checkout({ ...input(1), phone: `996700${String(i).padStart(6, '0')}` }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual(Array(12).fill(201));
    expect((await balance()).reserved).toBe('12');
  });
  it('separates proxied clients on Render and ignores forged earlier addresses', async () => {
    const previous = process.env.RENDER;
    let proxied: Awaited<ReturnType<typeof createApp>> | undefined;
    try {
      process.env.RENDER = 'true';
      proxied = await createApp(c.db);
      await proxied.init();
      const lookup = (forwarded: string) =>
        request(proxied!.getHttpServer())
          .post('/public/orders/receipt')
          .set('origin', 'http://localhost:5173')
          .set('x-forwarded-for', forwarded)
          .send({ checkoutKey: randomUUID() });
      for (let i = 0; i < 20; i++) await lookup('192.0.2.1').expect(404);
      await lookup('198.51.100.99, 192.0.2.1').expect(429);
      await lookup('192.0.2.2').expect(404);
    } finally {
      if (previous === undefined) delete process.env.RENDER;
      else process.env.RENDER = previous;
      await proxied?.close();
    }
    for (let i = 0; i < 20; i++)
      await request(http())
        .post('/public/orders/receipt')
        .set('origin', 'http://localhost:5173')
        .set('x-forwarded-for', `192.0.2.${i + 1}`)
        .send({ checkoutKey: randomUUID() })
        .expect(404);
    await receipt(randomUUID()).expect(429);
  });
  it('tenant/role guards protect contacts and management', async () => {
    const o = (await checkout(input()).expect(201)).body;
    await request(http()).get(`/shops/${fixture.shop}/orders`).expect(401);
    await request(http())
      .get(`/shops/${fixture.otherShop}/orders/${o.id}`)
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    const detail = (
      await request(http())
        .get(`/shops/${fixture.shop}/orders/${o.id}`)
        .auth(c.cashier, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(detail.name).toBe('Покупатель');
    expect(detail.lines[0].name).toBe('Чашка');
    await state(o.id, 'confirmed', c.cashier).expect(403);
    await state(o.id, 'issued').expect(400);
    await state(o.id, 'ready').expect(409);
  });
  it('cancels once and never changes physical stock or creates payments', async () => {
    const o = await ready();
    await state(o.id, 'cancelled').expect(201);
    await state(o.id, 'cancelled').expect(201);
    expect(await balance()).toEqual({
      physical: '5',
      reserved: '0',
      stock_value_minor: '40000',
    });
    await state(o.id, 'confirmed').expect(409);
    const [n] = await c.db.query('SELECT count(*)::int n FROM payment_records');
    expect(n.n).toBe(0);
  });
  it('expires unconfirmed orders on receipt lookup, exactly once, allowing a new order', async () => {
    const body = input();
    const o = (await checkout(body).expect(201)).body;
    await c.db.query(
      "UPDATE online_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",
      [o.id],
    );
    const r = await Promise.all([
      receipt(body.checkoutKey),
      receipt(body.checkoutKey),
    ]);
    expect(r.map((x) => x.body.status)).toEqual(['expired', 'expired']);
    expect((await balance()).reserved).toBe('0');
    expect((await checkout(input(5)).expect(201)).body.status).toBe('new');
  });
  it('waits for an in-flight expiration before returning the receipt', async () => {
    const body = input(),
      o = (await checkout(body).expect(201)).body;
    const blocker = c.db.createQueryRunner();
    await blocker.connect();
    await blocker.startTransaction();
    try {
      await blocker.query(
        "UPDATE online_orders SET expires_at=now()-interval '1 minute' WHERE id=$1",
        [o.id],
      );
      let settled = false;
      const response = receipt(body.checkoutKey).then((r) => {
        settled = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 100));
      const prematurelyReturned = settled;
      await blocker.commitTransaction();
      const result = await response;
      expect(prematurelyReturned).toBe(false);
      expect(result.body.status).toBe('expired');
      expect((await balance()).reserved).toBe('0');
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await blocker.release();
    }
  });
  it('issues agreed-price order once through cashier shift even after hiding or repricing', async () => {
    const o = await ready();
    const shift = (
      await privatePost(
        'pos/shifts',
        { openingCashMinor: 0 },
        c.cashier,
      ).expect(201)
    ).body;
    await c.db.query(
      'UPDATE variants SET sale_price_minor=20000,published=false WHERE id=$1',
      [v.id],
    );
    await c.db.query('UPDATE shops SET published=false WHERE id=$1', [
      fixture.shop,
    ]);
    const issue = () =>
      privatePost(
        `orders/${o.id}/issue`,
        { shiftId: shift.id, method: 'cash' },
        c.cashier,
      );
    const r = await Promise.all([issue(), issue()]);
    expect(r.map((x) => x.status)).toEqual([201, 201]);
    expect(r[0].body.saleId).toBe(r[1].body.saleId);
    expect(await balance()).toEqual({
      physical: '3',
      reserved: '0',
      stock_value_minor: '24000',
    });
    const p = await c.db.query(
      'SELECT amount_minor,method FROM payment_records',
    );
    expect(p).toEqual([{ amount_minor: '30000', method: 'cash' }]);
    const line = (
      await c.db.query('SELECT * FROM sale_lines WHERE document_id=$1', [
        r[0].body.saleId,
      ])
    )[0];
    expect(line.unit_price_minor).toBe('15000');
    await privatePost('pos/returns', {
      saleId: r[0].body.saleId,
      refundMoney: false,
      reason: 'Возврат',
      lines: [{ saleLineId: line.id, quantity: 1, condition: 'resellable' }],
    }).expect(201);
    expect((await balance()).physical).toBe('4');
  });
  it('preserves reservation if issue has no own open shift', async () => {
    const o = await ready();
    const shift = (
      await privatePost('pos/shifts', { openingCashMinor: 0 }).expect(201)
    ).body;
    await privatePost(
      `orders/${o.id}/issue`,
      { shiftId: shift.id, method: 'card' },
      c.cashier,
    ).expect(403);
    expect((await balance()).reserved).toBe('2');
    await state(o.id, 'cancelled').expect(201);
    await privatePost(`orders/${o.id}/issue`, {
      shiftId: shift.id,
      method: 'card',
    }).expect(409);
  });
});
