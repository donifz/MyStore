import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/auth/password';
import { createApp } from '../src/app';
import { EmailQueueService } from '../src/email/email-queue.service';
import { PartnerApplicationsService } from '../src/platform/partner-applications.service';
import { setup, teardown, fixture } from './helpers';
describe('password recovery', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries,access_operations');
  });
  afterEach(async () => {
    await teardown(c);
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  });
  function post(path: string, body: any, key = randomUUID()) {
    return request(c.app.getHttpServer())
      .post('/auth/password/' + path)
      .set('Origin', 'http://localhost:5173')
      .set('idempotency-key', key)
      .send(body);
  }
  async function forgot() {
    await post('forgot', { email: 'owner@example.test' }).expect(201);
    const [r] = await c.db.query(
      "SELECT * FROM email_deliveries WHERE secret_kind='reset' ORDER BY created_at DESC LIMIT 1",
    );
    return new URL(
      new EmailQueueService(c.db).decode(r).text.match(/http\S+/)![0],
    ).searchParams.get('token')!;
  }
  it('returns same neutral response for known and unknown addresses and deduplicates', async () => {
    const key = randomUUID();
    const known = await post(
      'forgot',
      { email: 'owner@example.test' },
      key,
    ).expect(201);
    await post('forgot', { email: 'owner@example.test' }, key).expect(201);
    const unknown = await post('forgot', {
      email: 'absent@example.test',
    }).expect(201);
    expect(known.body).toEqual(unknown.body);
    expect(known.body).toEqual({ accepted: true });
    expect(
      (await c.db.query('SELECT count(*)::int n FROM email_deliveries'))[0].n,
    ).toBe(1);
  });
  it('resets once, safely retries same key, revokes all old sessions and allows new password', async () => {
    const token = await forgot();
    const key = randomUUID();
    await post(
      'reset',
      { token, password: 'replacement-password' },
      key,
    ).expect(201);
    await post(
      'reset',
      { token, password: 'replacement-password' },
      key,
    ).expect(201);
    await post('reset', { token, password: 'replacement-password' }).expect(
      400,
    );
    await request(c.app.getHttpServer())
      .get('/auth/me')
      .auth(c.owner, { type: 'bearer' })
      .expect(401);
    await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.test', password: 'correct-test-password' })
      .expect(401);
    await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.test', password: 'replacement-password' })
      .expect(201);
  });
  it('rejects expired and replaced tokens and only one concurrent reset succeeds', async () => {
    const old = await forgot();
    const current = await forgot();
    await post('reset', {
      token: old,
      password: 'replacement-password',
    }).expect(400);
    const results = await Promise.all([
      post('reset', { token: current, password: 'replacement-password' }),
      post('reset', { token: current, password: 'replacement-password' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    const expired = await forgot();
    await c.db.query(
      "UPDATE password_resets SET expires_at=now()-interval '1 second'",
    );
    await post('reset', {
      token: expired,
      password: 'replacement-password',
    }).expect(400);
  });
  it('emails approved partner invitation in the same transaction', async () => {
    const service = c.app.get(PartnerApplicationsService);
    const a = await service.create({
      shopName: 'Partner',
      email: 'partner@example.test',
      phone: '+996700123456',
      city: 'Ош',
      address: '',
      category: 'Розница',
      agreed: true,
    });
    await service.decide(a.id, fixture.owner, {
      expectedStatus: 'new',
      decision: 'approved',
    });
    const [r] = await c.db.query(
      "SELECT * FROM email_deliveries WHERE secret_kind='partner'",
    );
    expect(r.recipient).toBe('partner@example.test');
    expect(new EmailQueueService(c.db).decode(r).text).toContain(
      '/partner/activate?token=',
    );
  });
  it('keeps neutral recovery response when email is not configured', async () => {
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    const a = await post('forgot', { email: 'owner@example.test' }).expect(201);
    const b = await post('forgot', { email: 'absent@example.test' }).expect(
      201,
    );
    expect(a.body).toEqual(b.body);
  });
  it('does not issue a session using a password checked before a concurrent password change', async () => {
    let login: any;
    await c.db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [
        fixture.owner,
      ]);
      login = request(c.app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'owner@example.test',
          password: 'correct-test-password',
        })
        .then((r) => r);
      let waiting = false;
      for (let i = 0; i < 100; i++) {
        const [r] = await c.db.query(
          "SELECT count(*)::int n FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND (query LIKE 'INSERT INTO sessions%' OR query LIKE 'SELECT id,password_hash FROM users%')",
        );
        if (r.n > 0) {
          waiting = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(waiting).toBe(true);
      await tx.query('UPDATE users SET password_hash=$2 WHERE id=$1', [
        fixture.owner,
        await hashPassword('replacement-password'),
      ]);
      await tx.query('DELETE FROM sessions WHERE user_id=$1', [fixture.owner]);
    });
    expect((await login).status).toBe(401);
  });
  it('keeps neutral recovery response for invalid public URL configuration', async () => {
    const old = process.env.PUBLIC_BASE_URL;
    process.env.PUBLIC_BASE_URL = 'invalid-url';
    try {
      const known = await post('forgot', {
        email: 'owner@example.test',
      }).expect(201);
      const unknown = await post('forgot', {
        email: 'absent@example.test',
      }).expect(201);
      expect(known.body).toEqual(unknown.body);
    } finally {
      if (old === undefined) delete process.env.PUBLIC_BASE_URL;
      else process.env.PUBLIC_BASE_URL = old;
    }
  });
  it('limits recovery independently from login and rejects foreign origins', async () => {
    await request(c.app.getHttpServer())
      .post('/auth/password/forgot')
      .set('Origin', 'https://evil.test')
      .set('idempotency-key', randomUUID())
      .send({ email: 'owner@example.test' })
      .expect(403);
    for (let n = 0; n < 20; n++)
      await post('forgot', { email: 'absent@example.test' }).expect(201);
    await post('forgot', { email: 'absent@example.test' }).expect(429);
    await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.test', password: 'correct-test-password' })
      .expect(201);
  });
});
