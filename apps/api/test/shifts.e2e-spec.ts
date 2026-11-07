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
  it('opens and closes with no inputs, storing calculated totals', async () => {
    const app = c.app.getHttpServer();
    const opened = await request(app)
      .post(root)
      .auth(c.cashier, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    expect(opened.body.openingCashMinor).toBe(0);
    expect(opened.body.expectedCashMinor).toBe(0);

    const key = randomUUID();
    const close = () =>
      request(app)
        .post(root + '/' + opened.body.id + '/close')
        .auth(c.cashier, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({});
    const done = await close().expect(201);
    expect(done.body.status).toBe('closed');
    expect(done.body.actualCashMinor).toBe(0);
    expect(done.body.discrepancyMinor).toBe(0);
    expect((await close().expect(201)).body.id).toBe(opened.body.id);
  });

  it('records optional expense exactly once in the same closing transaction', async () => {
    const app = c.app.getHttpServer();
    const opened = await open(c.cashier).expect(201);
    const key = randomUUID();
    const close = (expenseMinor: number) =>
      request(app)
        .post(root + '/' + opened.body.id + '/close')
        .auth(c.cashier, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({ expenseMinor });

    await close(1200).expect(400);
    expect(
      (
        await c.db.query(
          'SELECT count(*)::int AS count FROM cash_transactions WHERE shift_id=$1',
          [opened.body.id],
        )
      )[0].count,
    ).toBe(0);

    const result = await close(100).expect(201);
    expect(result.body.cashOutMinor).toBe(100);
    expect(result.body.expectedCashMinor).toBe(900);
    expect(result.body.actualCashMinor).toBe(900);
    expect(result.body.discrepancyMinor).toBe(0);
    const replay = await close(100).expect(201);
    expect(replay.body.expectedCashMinor).toBe(900);
    expect(
      (
        await c.db.query(
          'SELECT count(*)::int AS count FROM cash_transactions WHERE shift_id=$1',
          [opened.body.id],
        )
      )[0].count,
    ).toBe(1);
    await close(200).expect(409);
  });

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
