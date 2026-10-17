import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('owner-authorized platform financial access', () => {
  let c: Awaited<ReturnType<typeof setup>>,
    admin: string,
    adminId: string,
    second: string;
  const base = `/shops/${fixture.shop}/platform-access`;
  const post = (
    path: string,
    body: object,
    token = c.owner,
    key = randomUUID(),
  ) =>
    request(c.app.getHttpServer())
      .post(path)
      .auth(token, { type: 'bearer' })
      .set('idempotency-key', key)
      .send(body);
  const get = (path: string, token = admin) =>
    request(c.app.getHttpServer()).get(path).auth(token, { type: 'bearer' });
  const input = {
    adminEmail: 'support@example.test',
    purpose: 'Проверка финансовой сводки',
    durationHours: 24,
  };
  beforeEach(async () => {
    c = await setup(createApp);
    adminId = randomUUID();
    await c.db.query(
      "INSERT INTO users(id,email,password_hash) SELECT $1,'support@example.test',password_hash FROM users WHERE id=$2",
      [adminId, fixture.owner],
    );
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1),($2)', [
      adminId,
      fixture.cashier,
    ]);
    admin = (
      await request(c.app.getHttpServer())
        .post('/auth/login')
        .send({ email: input.adminEmail, password: 'correct-test-password' })
        .expect(201)
    ).body.token;
    second = c.cashier;
  });
  afterEach(async () => {
    await teardown(c);
  });
  it('keeps every shop financial field out of the automatic platform overview', async () => {
    const result = await get('/platform/admin/overview').expect(200);
    for (const field of [
      'todaySalesMinor',
      'sales',
      'categories',
      'openShifts',
    ])
      expect(result.body).not.toHaveProperty(field);
    for (const shop of result.body.shops)
      for (const field of ['units', 'shiftOpen', 'lastShiftAt', 'ownerEmail'])
        expect(shop).not.toHaveProperty(field);
    await get(`/shops/${fixture.shop}/reports/summary`).expect(403);
  });
  it('grants to one administrator, audits every explicit read, and revokes immediately', async () => {
    const key = randomUUID();
    const granted = await post(base, input, c.owner, key).expect(201);
    const id = granted.body.id;
    expect((await post(base, input, c.owner, key).expect(201)).body.id).toBe(
      id,
    );
    const path = `/platform/admin/financial-access/${id}/summary`;
    await get(path, second).expect(403);
    const summary = await get(path).expect(200);
    expect(summary.body).toHaveProperty('grossProfitMinor', 0);
    await get(path).expect(200);
    expect(
      (
        await c.db.query(
          "SELECT count(*)::int n FROM audit_log WHERE action='platform-access:read'",
        )
      )[0].n,
    ).toBe(2);
    expect(
      (await get('/platform/admin/financial-access')).body.items,
    ).toHaveLength(1);
    expect(
      (await get('/platform/admin/financial-access', second)).body.items,
    ).toHaveLength(0);
    const revokeKey = randomUUID();
    await post(base + '/' + id + '/revoke', {}, c.owner, revokeKey).expect(201);
    await post(base + '/' + id + '/revoke', {}, c.owner, revokeKey).expect(201);
    await get(path).expect(403);
    const audit = await c.db.query(
      "SELECT action,shop_id,actor_id,details FROM audit_log WHERE action LIKE 'platform-access:%' ORDER BY id",
    );
    expect(audit.map((r: any) => r.action)).toEqual([
      'platform-access:grant',
      'platform-access:read',
      'platform-access:read',
      'platform-access:revoke',
    ]);
    expect(audit[0]).toMatchObject({
      shop_id: fixture.shop,
      actor_id: fixture.owner,
    });
    expect(audit[1]).toMatchObject({ actor_id: adminId });
  });
  it('rejects self-grants, non-owner management, foreign shops and invalid duration/purpose', async () => {
    await post(base, input, second).expect(403);
    await post(base, input, admin).expect(403);
    await post(`/shops/${fixture.otherShop}/platform-access`, input).expect(
      403,
    );
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      fixture.owner,
    ]);
    await post(base, { ...input, adminEmail: 'owner@example.test' }).expect(
      403,
    );
    for (const durationHours of [0, 169, 1.5])
      await post(base, { ...input, durationHours }).expect(400);
    await post(base, { ...input, purpose: '   ' }).expect(400);
    await post(base, { ...input, adminEmail: 'absent@example.test' }).expect(
      400,
    );
    await post(base, { ...input, canReturn: true }).expect(400);
  });
  it('rejects expired or removed administrators and audits no rejected reads', async () => {
    const id = (await post(base, input).expect(201)).body.id;
    const path = `/platform/admin/financial-access/${id}/summary`;
    await c.db.query(
      "UPDATE platform_financial_grants SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [id],
    );
    await get(path).expect(403);
    await c.db.query(
      "UPDATE platform_financial_grants SET expires_at=clock_timestamp()+interval '1 hour' WHERE id=$1",
      [id],
    );
    await c.db.query('DELETE FROM platform_admins WHERE user_id=$1', [adminId]);
    await get(path).expect(403);
    expect(
      (
        await c.db.query(
          "SELECT count(*)::int n FROM audit_log WHERE action='platform-access:read'",
        )
      )[0].n,
    ).toBe(0);
  });
  it('rolls back grants, revocation and financial reads if auditing fails', async () => {
    await c.db.query(
      "CREATE FUNCTION fail_platform_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'platform-access:%' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_platform_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_platform_audit()",
    );
    try {
      await post(base, input).expect(500);
      expect(
        (
          await c.db.query(
            'SELECT count(*)::int n FROM platform_financial_grants',
          )
        )[0].n,
      ).toBe(0);
    } finally {
      await c.db.query(
        'DROP TRIGGER fail_platform_audit ON audit_log; DROP FUNCTION fail_platform_audit()',
      );
    }
    const id = (await post(base, input).expect(201)).body.id;
    await c.db.query(
      "CREATE FUNCTION fail_platform_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action LIKE 'platform-access:%' THEN RAISE EXCEPTION 'audit unavailable'; END IF; RETURN NEW; END $$; CREATE TRIGGER fail_platform_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION fail_platform_audit()",
    );
    try {
      await post(base + '/' + id + '/revoke', {}).expect(500);
      await get(`/platform/admin/financial-access/${id}/summary`).expect(500);
      expect(
        (
          await c.db.query(
            'SELECT revoked_at FROM platform_financial_grants WHERE id=$1',
            [id],
          )
        )[0].revoked_at,
      ).toBeNull();
    } finally {
      await c.db.query(
        'DROP TRIGGER fail_platform_audit ON audit_log; DROP FUNCTION fail_platform_audit()',
      );
    }
  });
});
