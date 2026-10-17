import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('owner business-hours settings', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const schedule = () => [
    ...Array.from({ length: 5 }, () => [{ open: '10:00', close: '19:00' }]),
    [],
    [],
  ];
  const profile = {
    description: 'Магазин',
    city: 'Ош',
    address: 'Центр',
    phone: '+996700123456',
    hours: 'По звонку',
    published: true,
  };
  const path = `/shops/${fixture.shop}/storefront`;
  const put = (extra: Record<string, unknown> = {}, token?: string) =>
    request(c.app.getHttpServer())
      .put(path)
      .auth(token ?? c.owner, { type: 'bearer' })
      .send({ ...profile, ...extra });
  const get = () =>
    request(c.app.getHttpServer()).get(path).auth(c.owner, { type: 'bearer' });
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });

  it('keeps unknown legacy hours until the owner explicitly configures a week', async () => {
    const initial = (await get().expect(200)).body;
    expect(initial).toMatchObject({
      timeZone: 'Asia/Bishkek',
      businessSchedule: null,
      reservationPolicy: 'legacy-30-minutes',
    });
    const saved = (
      await put({
        timeZone: 'Asia/Bishkek',
        businessSchedule: schedule(),
      }).expect(200)
    ).body;
    expect(saved.businessSchedule).toEqual(schedule());
    expect(saved.reservationPolicy).toBe('business-hours');
    expect(saved.hours).toContain('Сб: выходной');
    expect(
      new Date(saved.confirmationPreview.expiresAt).getTime(),
    ).toBeGreaterThan(new Date(saved.confirmationPreview.from).getTime());
    const legacy = (await put().expect(200)).body;
    expect(legacy.businessSchedule).toEqual(schedule());
    expect(legacy.hours).toBe(saved.hours);
    const cleared = (await put({ businessSchedule: null }).expect(200)).body;
    expect(cleared).toMatchObject({
      businessSchedule: null,
      reservationPolicy: 'legacy-30-minutes',
      hours: profile.hours,
    });
  });

  it('rejects malformed settings without changing any profile field', async () => {
    await put({ businessSchedule: schedule() }).expect(200);
    for (const extra of [
      { timeZone: 'bad-zone' },
      { timeZone: null },
      { businessSchedule: [] },
      { businessSchedule: Array(7).fill([]) },
      { businessSchedule: '10:00-19:00' },
      {
        businessSchedule: [
          [{ open: '21:00', close: '02:00' }],
          [{ open: '01:00', close: '04:00' }],
          ...Array(5).fill([]),
        ],
      },
    ]) {
      const before = (await get()).body;
      await put({ ...extra, city: 'Не сохранять' }).expect(400);
      const after = (await get()).body;
      expect(after.city).toBe(before.city);
      expect(after.businessSchedule).toEqual(before.businessSchedule);
      expect(after.timeZone).toBe(before.timeZone);
    }
  });

  it('checks tenant and owner rights in the API', async () => {
    await put({ businessSchedule: schedule() }, c.cashier).expect(403);
    const manager = randomUUID();
    await c.db.query(
      'INSERT INTO users(id,email,password_hash) SELECT $1,$2,password_hash FROM users WHERE id=$3',
      [manager, 'manager-hours@example.test', fixture.owner],
    );
    await c.db.query(
      "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'manager')",
      [fixture.shop, manager],
    );
    const login = await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'manager-hours@example.test',
        password: 'correct-test-password',
      })
      .expect(201);
    await put({ businessSchedule: schedule() }, login.body.token).expect(403);
    await request(c.app.getHttpServer())
      .put(`/shops/${fixture.otherShop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, businessSchedule: schedule() })
      .expect(403);
  });

  it('audits a real schedule change and rolls back the profile if audit fails', async () => {
    await put({ businessSchedule: schedule() }).expect(200);
    await put({ businessSchedule: schedule() }).expect(200);
    const rows = await c.db.query(
      "SELECT * FROM audit_log WHERE entity_type='shop_schedule' AND shop_id=$1",
      [fixture.shop],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(fixture.owner);
    await c.db.query(
      `CREATE FUNCTION test_hours_audit_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.entity_type='shop_schedule' THEN RAISE EXCEPTION 'audit fail'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_hours_audit_fail BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION test_hours_audit_fail()`,
    );
    try {
      await put({ businessSchedule: null, city: 'Не сохранять' }).expect(500);
      const after = (await get()).body;
      expect(after.businessSchedule).toEqual(schedule());
      expect(after.city).toBe(profile.city);
    } finally {
      await c.db.query(
        'DROP TRIGGER test_hours_audit_fail ON audit_log; DROP FUNCTION test_hours_audit_fail()',
      );
    }
  });

  it('does not expose structured settings through public store endpoints', async () => {
    const saved = (await put({ businessSchedule: schedule() }).expect(200))
      .body;
    const publicStore = (
      await request(c.app.getHttpServer())
        .get(`/public/stores/${saved.slug}`)
        .expect(200)
    ).body;
    expect(publicStore.hours).toBe(saved.hours);
    expect(publicStore.businessSchedule).toBeUndefined();
    expect(publicStore.confirmationPreview).toBeUndefined();
  });

  it('can migrate down and up without changing existing shop identity or hours', async () => {
    await put().expect(200);
    await c.db.undoLastMigration();
    const [before] = await c.db.query(
      'SELECT id,hours FROM shops WHERE id=$1',
      [fixture.shop],
    );
    expect(before).toEqual({ id: fixture.shop, hours: profile.hours });
    await c.db.runMigrations();
    const after = (await get().expect(200)).body;
    expect(after.hours).toBe(profile.hours);
    expect(after.businessSchedule).toBeNull();
  });
});
