import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('cash shifts', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  const root = `/shops/${fixture.shop}/pos/shifts`;
  function open(token: string, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post(root)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ openingCashMinor: 1000 });
  }
  it('only opens one shift concurrently and replays its key', async () => {
    const key = randomUUID();
    const a = await open(c.owner, key).expect(201);
    const b = await open(c.owner, key).expect(201);
    expect(b.body.id).toBe(a.body.id);
    await open(c.cashier).expect(409);
    await c.db.query('TRUNCATE cash_shifts CASCADE');
    const results = await Promise.all([open(c.owner), open(c.cashier)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  it('requires discrepancy comment and protects reports', async () => {
    const a = await open(c.owner).expect(201);
    await request(c.app.getHttpServer())
      .get(root + '/' + a.body.id)
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);
    const current = await request(c.app.getHttpServer())
      .get(root + '/current')
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
    expect(current.body).toEqual({ occupied: true });
    const close = (body: any) =>
      request(c.app.getHttpServer())
        .post(root + '/' + a.body.id + '/close')
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send(body);
    await close({ actualCashMinor: 900 }).expect(400);
    const done = await close({
      actualCashMinor: 900,
      comment: 'Пересчёт',
    }).expect(201);
    expect(done.body.discrepancyMinor).toBe(-100);
    expect(done.body.status).toBe('closed');
  });
  it('owner must comment to close a cashier shift and rejects foreign shops', async () => {
    const a = await open(c.cashier).expect(201);
    const active = await request(c.app.getHttpServer())
      .get(root + '/active')
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(active.body.id).toBe(a.body.id);
    await request(c.app.getHttpServer())
      .get(root + '/active')
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);
    await request(c.app.getHttpServer())
      .post(root + '/' + a.body.id + '/close')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ actualCashMinor: 1000 })
      .expect(400);
    await request(c.app.getHttpServer())
      .post(root + '/' + a.body.id + '/close')
      .auth(c.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ actualCashMinor: 1000, comment: 'Закрытие владельцем' })
      .expect(201);
    await request(c.app.getHttpServer())
      .get(`/shops/${fixture.otherShop}/pos/shifts/current`)
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
  });
});
