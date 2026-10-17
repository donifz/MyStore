import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture, approveTestProduct } from './helpers';
import { businessDeadline } from '../src/orders/business-hours';
import { OrdersService } from '../src/orders/orders.service';
import { OrderExpirationService } from '../src/orders/order-expiration.service';

describe('business-hours order reservation', () => {
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

  const week = () =>
    Array.from({ length: 7 }, () => [{ open: '10:00', close: '19:00' }]);
  async function configure() {
    await c.db.query(
      'UPDATE shops SET time_zone=$2,business_schedule=$3 WHERE id=$1',
      [fixture.shop, 'Asia/Bishkek', JSON.stringify(week())],
    );
  }
  it('uses transaction-time business hours and keeps the original deadline on retry', async () => {
    await configure();
    const body = input();
    const order = (await checkout(body).expect(201)).body;
    const [row] = await c.db.query(
      'SELECT created_at,expires_at FROM online_orders WHERE id=$1',
      [order.id],
    );
    expect(order.expiresAt).toBe(
      businessDeadline(row.created_at, week(), 'Asia/Bishkek').toISOString(),
    );
    await c.db.query(
      'UPDATE shops SET time_zone=$2,business_schedule=NULL WHERE id=$1',
      [fixture.shop, 'Europe/Berlin'],
    );
    expect((await checkout(body).expect(201)).body).toEqual(order);
    const [count] = await c.db.query(
      'SELECT count(*)::int n FROM online_orders',
    );
    expect(count.n).toBe(1);
    expect(await balance()).toMatchObject({
      physical: '5',
      reserved: '2',
      stock_value_minor: '40000',
    });
    const [payments] = await c.db.query(
      'SELECT count(*)::int n FROM payment_records',
    );
    expect(payments.n).toBe(0);
    const [documents] = await c.db.query(
      'SELECT count(*)::int n FROM stock_documents',
    );
    expect(documents.n).toBe(1);
    expect(order.timeZone).toBeUndefined();
    const detail = (
      await request(http())
        .get(`/shops/${fixture.shop}/orders/${order.id}`)
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(detail.timeZone).toBe('Europe/Berlin');
  });
  it('keeps the labeled legacy deadline at thirty minutes', async () => {
    const order = (await checkout(input()).expect(201)).body;
    const [row] = await c.db.query(
      'SELECT created_at FROM online_orders WHERE id=$1',
      [order.id],
    );
    expect(new Date(order.expiresAt).getTime() - row.created_at.getTime()).toBe(
      30 * 60_000,
    );
    await configure();
    expect((await receipt(input().checkoutKey)).status).toBe(404);
    const [stored] = await c.db.query(
      'SELECT expires_at FROM online_orders WHERE id=$1',
      [order.id],
    );
    expect(stored.expires_at.toISOString()).toBe(order.expiresAt);
  });
  it('rolls back checkout when a persisted schedule cannot be calculated', async () => {
    await c.db.query('UPDATE shops SET business_schedule=$2 WHERE id=$1', [
      fixture.shop,
      JSON.stringify(Array(7).fill([])),
    ]);
    await checkout(input()).expect(500);
    const [orders] = await c.db.query(
      'SELECT count(*)::int n FROM online_orders',
    );
    const [lines] = await c.db.query(
      'SELECT count(*)::int n FROM online_order_lines',
    );
    expect(orders.n).toBe(0);
    expect(lines.n).toBe(0);
    expect(await balance()).toMatchObject({
      physical: '5',
      reserved: '0',
      stock_value_minor: '40000',
    });
  });
  it('releases an expired reservation once across repeated sweeps', async () => {
    await configure();
    const order = (await checkout(input()).expect(201)).body;
    await c.db.query(
      "UPDATE online_orders SET expires_at=now()-interval '1 second' WHERE id=$1",
      [order.id],
    );
    await Promise.all([
      c.app.get(OrderExpirationService).expire(),
      c.app.get(OrderExpirationService).expire(),
    ]);
    await c.app.get(OrderExpirationService).expire();
    expect(await balance()).toMatchObject({
      physical: '5',
      reserved: '0',
      stock_value_minor: '40000',
    });
    expect(
      (
        await c.db.query('SELECT status FROM online_orders WHERE id=$1', [
          order.id,
        ])
      )[0].status,
    ).toBe('expired');
  });
  it('does not expire confirmed orders and serializes a confirmation against expiry', async () => {
    await configure();
    const order = (await checkout(input()).expect(201)).body;
    await Promise.allSettled([
      c.app.get(OrderExpirationService).expire(),
      state(order.id, 'confirmed').expect(201),
    ]);
    await c.db.query(
      "UPDATE online_orders SET expires_at=now()-interval '1 second' WHERE id=$1",
      [order.id],
    );
    await c.app.get(OrderExpirationService).expire();
    expect(
      (
        await c.db.query('SELECT status FROM online_orders WHERE id=$1', [
          order.id,
        ])
      )[0].status,
    ).toBe('confirmed');
    expect(await balance()).toMatchObject({ physical: '5', reserved: '2' });
    const other = (await checkout(input(1)).expect(201)).body;
    await c.db.query(
      "UPDATE online_orders SET expires_at=now()-interval '1 second' WHERE id=$1",
      [other.id],
    );
    await Promise.allSettled([
      c.app.get(OrderExpirationService).expire(),
      state(other.id, 'confirmed'),
    ]);
    await c.app.get(OrderExpirationService).expire();
    expect(
      (
        await c.db.query('SELECT status FROM online_orders WHERE id=$1', [
          other.id,
        ])
      )[0].status,
    ).toBe('expired');
    expect(await balance()).toMatchObject({
      physical: '5',
      reserved: '2',
      stock_value_minor: '40000',
    });
  });
});
