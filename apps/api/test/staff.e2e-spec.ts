import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { EmailQueueService } from '../src/email/email-queue.service';
import { setup, teardown, fixture } from './helpers';
describe('staff access', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    c = await setup(createApp);
    await c.db.query('TRUNCATE access_operations,email_deliveries');
  });
  afterEach(async () => {
    await teardown(c);
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  });
  const base = `/shops/${fixture.shop}/staff`;
  function post(path: string, body: any, token = c.owner, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('Origin', 'http://localhost:5173')
      .set('idempotency-key', key)
      .send(body);
  }
  async function invite(email = 'new@example.test') {
    const result = await post(base + '/invitations', {
      email,
      role: 'cashier',
    }).expect(201);
    const [row] = await c.db.query(
      "SELECT * FROM email_deliveries WHERE secret_kind='staff' ORDER BY created_at DESC LIMIT 1",
    );
    const text = new EmailQueueService(c.db).decode(row).text;
    return {
      id: result.body.id,
      token: new URL(text.match(/http\S+/)![0]).searchParams.get('token')!,
    };
  }
  it('owner invites new cashier once, accepts once, audits and disables access', async () => {
    const key = randomUUID();
    await post(
      base + '/invitations',
      { email: 'new@example.test', role: 'cashier' },
      c.owner,
      key,
    ).expect(201);
    await post(
      base + '/invitations',
      { email: 'new@example.test', role: 'cashier' },
      c.owner,
      key,
    ).expect(201);
    expect(
      (await c.db.query('SELECT count(*)::int n FROM email_deliveries'))[0].n,
    ).toBe(1);
    const [row] = await c.db.query('SELECT * FROM email_deliveries');
    const token = new URL(
      new EmailQueueService(c.db).decode(row).text.match(/http\S+/)![0],
    ).searchParams.get('token');
    await post('/auth/staff/accept', {
      token,
      password: 'new-test-password',
    }).expect(201);
    await post('/auth/staff/accept', {
      token,
      password: 'new-test-password',
    }).expect(400);
    const login = await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'new@example.test', password: 'new-test-password' })
      .expect(201);
    const [user] = await c.db.query(
      "SELECT id FROM users WHERE email='new@example.test'",
    );
    await request(c.app.getHttpServer())
      .get('/auth/me')
      .auth(login.body.token, { type: 'bearer' })
      .expect(200);
    await post(base + '/' + user.id + '/role', { role: 'manager' }).expect(201);
    await post(base + '/' + user.id + '/disable', {}).expect(201);
    await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/access`)
      .auth(login.body.token, { type: 'bearer' })
      .expect(403);
    expect(
      JSON.stringify(await c.db.query('SELECT details FROM audit_log')),
    ).not.toContain(token);
  });
  it('rejects cashier, foreign shop, owner mutation and invalid role', async () => {
    await post(
      base + '/invitations',
      { email: 'x@example.test', role: 'manager' },
      c.cashier,
    ).expect(403);
    await post(`/shops/${fixture.otherShop}/staff/invitations`, {
      email: 'x@example.test',
      role: 'manager',
    }).expect(403);
    await post(base + '/' + fixture.owner + '/disable', {}).expect(403);
    await post(base + '/invitations', {
      email: 'x@example.test',
      role: 'owner',
    }).expect(400);
  });
  it('requires existing invited account without changing its password', async () => {
    await c.db.query('DELETE FROM memberships WHERE user_id=$1', [
      fixture.cashier,
    ]);
    const i = await invite('cashier@example.test');
    await post('/auth/staff/accept', {
      token: i.token,
      password: 'attempt-to-steal',
    }).expect(403);
    await post('/auth/staff/accept', { token: i.token }, c.cashier).expect(201);
    await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'cashier@example.test',
        password: 'correct-test-password',
      })
      .expect(201);
  });
  it('cancels, expires and supersedes invitations', async () => {
    const a = await invite();
    await post(base + '/invitations/' + a.id + '/cancel', {}).expect(201);
    await post('/auth/staff/accept', {
      token: a.token,
      password: 'new-test-password',
    }).expect(400);
    const b = await invite();
    await c.db.query(
      "UPDATE staff_invitations SET expires_at=now()-interval '1 second' WHERE id=$1",
      [b.id],
    );
    await post('/auth/staff/accept', {
      token: b.token,
      password: 'new-test-password',
    }).expect(400);
    const d = await invite();
    const e = await invite();
    await post('/auth/staff/accept', {
      token: d.token,
      password: 'new-test-password',
    }).expect(400);
    const results = await Promise.all([
      post('/auth/staff/accept', {
        token: e.token,
        password: 'new-test-password',
      }),
      post('/auth/staff/accept', {
        token: e.token,
        password: 'new-test-password',
      }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
  });
  it('blocks changing or disabling staff with an open shift', async () => {
    await post(
      `/shops/${fixture.shop}/pos/shifts`,
      { openingCashMinor: 0 },
      c.cashier,
    ).expect(201);
    await post(base + '/' + fixture.cashier + '/disable', {}).expect(409);
    await post(base + '/' + fixture.cashier + '/role', {
      role: 'manager',
    }).expect(409);
  });
  it('allows new account acceptance with a revoked optional cookie', async () => {
    const i = await invite('revoked-cookie@example.test');
    await request(c.app.getHttpServer())
      .post('/auth/staff/accept')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'mystore_session=' + c.owner)
      .set('idempotency-key', randomUUID())
      .send({ token: i.token, password: 'new-test-password' })
      .expect(403);
    await c.db.query('DELETE FROM sessions');
    const accepted = await request(c.app.getHttpServer())
      .post('/auth/staff/accept')
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', 'mystore_session=' + c.owner)
      .set('idempotency-key', randomUUID())
      .send({ token: i.token, password: 'new-test-password' })
      .expect(201);
    expect(accepted.headers['set-cookie'][0]).toContain('mystore_session=;');
  });
});
