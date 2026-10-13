import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { EmailQueueService } from '../src/email/email-queue.service';
describe('email settings and diagnostics', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries,access_operations');
  });
  afterEach(async () => teardown(c));
  const base = `/shops/${fixture.shop}/email`;
  function get(path: string, token = c.owner) {
    return request(c.app.getHttpServer())
      .get(path)
      .auth(token, { type: 'bearer' });
  }
  function post(path: string, body: any, token = c.owner, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);
  }
  it('denies foreign shop/cashier delivery status and exposes redacted own status', async () => {
    const id = await c.db.transaction((tx) =>
      new EmailQueueService(c.db).enqueue(
        tx,
        'diagnostic',
        {
          to: 'a@example.test',
          subject: 'secret subject',
          text: 'hidden-body',
        },
        fixture.shop,
      ),
    );
    await c.db.query(
      "UPDATE email_deliveries SET status='failed' WHERE id=$1",
      [id],
    );
    await get(base + '/status', c.cashier).expect(403);
    await get(`/shops/${fixture.otherShop}/email/status`).expect(403);
    const status = await get(base + '/status').expect(200);
    expect(JSON.stringify(status.body)).not.toContain('hidden-body');
    expect(status.body.enabled).toBe(false);
    const key = randomUUID();
    await post(base + '/deliveries/' + id + '/retry', {}, c.owner, key).expect(
      201,
    );
    await post(base + '/deliveries/' + id + '/retry', {}, c.owner, key).expect(
      201,
    );
    expect(
      (
        await c.db.query('SELECT status FROM email_deliveries WHERE id=$1', [
          id,
        ])
      )[0].status,
    ).toBe('pending');
  });
  it('stores user scoped preferences and verifies boolean inputs', async () => {
    expect((await get(base + '/preferences').expect(200)).body).toEqual({
      orders: true,
      moderation: true,
    });
    await post(base + '/preferences', {
      orders: false,
      moderation: true,
    }).expect(201);
    expect((await get(base + '/preferences').expect(200)).body.orders).toBe(
      false,
    );
    expect(
      (await get(base + '/preferences', c.cashier).expect(200)).body.orders,
    ).toBe(true);
    await post(base + '/preferences', {
      orders: 'false',
      moderation: true,
    }).expect(400);
  });
});
