import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('partner review and activation', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const origin = 'http://localhost:5173';
  const application = {
    shopName: 'Новый магазин',
    email: 'New@Example.test',
    phone: '+996700123456',
    city: 'Ош',
    address: 'Центр',
    category: 'Подарки',
    agreed: true,
  };
  const http = () => c.app.getHttpServer();
  const submit = (body = application) =>
    request(http())
      .post('/partners/applications')
      .set('origin', origin)
      .send(body);

  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });

  async function admin() {
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      fixture.owner,
    ]);
    return c.owner;
  }

  it('queues a normalized application without creating an account or shop', async () => {
    const created = await submit().expect(201);
    expect(created.body).toMatchObject({ status: 'new' });
    expect(created.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    await submit({ ...application, email: 'new@example.test' }).expect(409);
    const [counts] = await c.db.query(
      'SELECT (SELECT count(*)::int FROM users) users,(SELECT count(*)::int FROM shops) shops',
    );
    expect(counts).toEqual({ users: 2, shops: 2 });
    await request(http())
      .post('/partners/register')
      .set('origin', origin)
      .send({
        shopName: application.shopName,
        email: application.email,
        password: 'old-registration-password',
      })
      .expect(404);
  });

  it('guards the queue and records a rejection reason without creating a shop', async () => {
    const created = await submit().expect(201);
    await request(http()).get('/platform/admin/applications').expect(401);
    await request(http())
      .get('/platform/admin/applications')
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    const token = await admin();
    const list = await request(http())
      .get('/platform/admin/applications')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(list.body.items[0]).toMatchObject({
      id: created.body.id,
      email: 'new@example.test',
      status: 'new',
    });
    await request(http())
      .post(`/platform/admin/applications/${created.body.id}/decision`)
      .auth(token, { type: 'bearer' })
      .send({ expectedStatus: 'new', decision: 'rejected', reason: '' })
      .expect(400);
    await request(http())
      .post(`/platform/admin/applications/${created.body.id}/decision`)
      .auth(token, { type: 'bearer' })
      .send({
        expectedStatus: 'new',
        decision: 'rejected',
        reason: 'Нужны документы',
      })
      .expect(201);
    const [row] = await c.db.query(
      'SELECT status, rejection_reason FROM partner_applications WHERE id=$1',
      [created.body.id],
    );
    expect(row).toEqual({
      status: 'rejected',
      rejection_reason: 'Нужны документы',
    });
    const [count] = await c.db.query('SELECT count(*)::int n FROM shops');
    expect(count.n).toBe(2);
  });

  it('approves once and activates the owner with a single-use invitation', async () => {
    const created = await submit().expect(201);
    const token = await admin();
    const url = `/platform/admin/applications/${created.body.id}/decision`;
    const reviewing = await request(http())
      .post(url)
      .auth(token, { type: 'bearer' })
      .send({ expectedStatus: 'new', decision: 'in_review' })
      .expect(201);
    expect(reviewing.body.status).toBe('in_review');
    const approved = await request(http())
      .post(url)
      .auth(token, { type: 'bearer' })
      .send({ expectedStatus: 'in_review', decision: 'approved' })
      .expect(201);
    expect(approved.body.activationUrl).toMatch(
      /^\/partner\/activate\?token=[a-f0-9]{64}$/,
    );
    await request(http())
      .post(url)
      .auth(token, { type: 'bearer' })
      .send({ expectedStatus: 'in_review', decision: 'approved' })
      .expect(409);
    const [shop] = await c.db.query('SELECT published FROM shops WHERE id=$1', [
      approved.body.shopId,
    ]);
    expect(shop.published).toBe(false);
    const [before] = await c.db.query(
      "SELECT count(*)::int n FROM users WHERE email='new@example.test'",
    );
    expect(before.n).toBe(0);
    const invite = new URL(
      approved.body.activationUrl,
      'http://local',
    ).searchParams.get('token');
    await request(http())
      .post('/partners/invitations/activate')
      .set('origin', origin)
      .send({ token: invite, password: 'new-secure-password' })
      .expect(201);
    await request(http())
      .post('/partners/invitations/activate')
      .set('origin', origin)
      .send({ token: invite, password: 'new-secure-password' })
      .expect(400);
    const [membership] = await c.db.query(
      "SELECT m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE u.email='new@example.test' AND m.shop_id=$1",
      [approved.body.shopId],
    );
    expect(membership.role).toBe('owner');
  });

  it('rejects expired invites and competing decisions without duplicates', async () => {
    const created = await submit().expect(201);
    const token = await admin();
    const url = `/platform/admin/applications/${created.body.id}/decision`;
    const results = await Promise.all(
      [1, 2].map(() =>
        request(http())
          .post(url)
          .auth(token, { type: 'bearer' })
          .send({ expectedStatus: 'new', decision: 'approved' }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const success = results.find((r) => r.status === 201)!;
    const [count] = await c.db.query(
      'SELECT count(*)::int n FROM partner_application_events WHERE application_id=$1 AND status=$2',
      [created.body.id, 'approved'],
    );
    expect(count.n).toBe(1);
    await c.db.query(
      "UPDATE partner_invitations SET expires_at=now()-interval '1 minute' WHERE application_id=$1",
      [created.body.id],
    );
    const invite = new URL(
      success.body.activationUrl,
      'http://local',
    ).searchParams.get('token');
    await request(http())
      .post('/partners/invitations/activate')
      .set('origin', origin)
      .send({ token: invite, password: 'new-secure-password' })
      .expect(400);
  });
  it('creates a toy shop with predefined isolated categories on approval', async () => {
    const submitted = await submit({
      ...application,
      email: 'toys@example.test',
      category: 'Игрушки',
      shopType: 'toys',
    }).expect(201);
    const token = await admin();
    const result = await request(http())
      .post(`/platform/admin/applications/${submitted.body.id}/decision`)
      .auth(token, { type: 'bearer' })
      .send({ expectedStatus: 'new', decision: 'approved' })
      .expect(201);
    const [shop] = await c.db.query(
      'SELECT shop_type FROM shops WHERE id=$1',
      [result.body.shopId],
    );
    expect(shop.shop_type).toBe('toys');
    const categories = await c.db.query(
      'SELECT name,platform_category_code FROM shop_categories WHERE shop_id=$1 AND parent_id IS NULL ORDER BY name',
      [result.body.shopId],
    );
    expect(categories.map((row: any) => row.name)).toContain('Робототехника');
    expect(categories.every((row: any) => row.platform_category_code === 'toys')).toBe(true);
    const [leaks] = await c.db.query(
      "SELECT count(*)::int n FROM shop_categories WHERE shop_id=$1 AND name='Робототехника'",
      [fixture.shop],
    );
    expect(leaks.n).toBe(0);
  });

});
