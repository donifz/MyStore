import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('public storefront', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const profile = {
    description: 'Товары для дома',
    city: 'Ош',
    address: 'Центр',
    phone: '+996700123456',
    hours: '10:00–19:00',
    published: true,
  };
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  const http = () => c.app.getHttpServer();
  async function publish() {
    return (
      await request(http())
        .put(`/shops/${fixture.shop}/storefront`)
        .auth(c.owner, { type: 'bearer' })
        .send(profile)
        .expect(200)
    ).body;
  }
  async function variant(name = 'Чашка%', price = 15000) {
    return (
      await request(http())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .send({ name, salePriceMinor: price })
        .expect(201)
    ).body;
  }
  it('keeps existing shops hidden, restricts profile to owner and validates publication', async () => {
    const r = await request(http()).get('/public/stores').expect(200);
    expect(r.body.total).toBe(0);
    const own = await request(http())
      .get(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(own.body.published).toBe(false);
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.cashier, { type: 'bearer' })
      .send(profile)
      .expect(403);
    await request(http())
      .get(`/shops/${fixture.otherShop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, phone: '' })
      .expect(400);
    const published = await publish();
    expect(published.slug).toBe(own.body.slug);
    const list = await request(http()).get('/public/stores').expect(200);
    expect(list.body.items.map((x: any) => x.slug)).toEqual([published.slug]);
  });
  it('uses real inventory after receiving and selling without exposing financial data', async () => {
    const shop = await publish(),
      v = await variant();
    const receive = () =>
      request(http())
        .post(`/shops/${fixture.shop}/receivings`)
        .auth(c.owner, { type: 'bearer' })
        .set('idempotency-key', randomUUID())
        .send({
          lines: [{ variantId: v.id, quantity: 5, unitCostMinor: 8000 }],
        })
        .expect(201);
    await receive();
    await request(http())
      .post(`/shops/${fixture.shop}/sales`)
      .auth(c.owner, { type: 'bearer' })
      .set('idempotency-key', randomUUID())
      .send({
        lines: [
          { variantId: v.id, quantity: 2, expectedUnitPriceMinor: 15000 },
        ],
      })
      .expect(201);
    const r = await request(http())
      .get(`/public/stores/${shop.slug}/products/${v.id}`)
      .expect(200);
    expect(r.body).toEqual({
      id: v.id,
      name: 'Чашка%',
      description: '',
      category: '',
      salePriceMinor: 15000,
      available: 3,
      store: {
        slug: shop.slug,
        name: 'Test Shop',
        city: 'Ош',
        phone: profile.phone,
        address: 'Центр',
        hours: '10:00–19:00',
      },
    });
    expect(r.headers['cache-control']).toBe('no-store');
    await c.db.query(
      'UPDATE stock_balances SET reserved=1 WHERE variant_id=$1',
      [v.id],
    );
    const next = await request(http())
      .get(`/public/stores/${shop.slug}/products/${v.id}`)
      .expect(200);
    expect(next.body.available).toBe(2);
  });
  it('scopes products, filters literal input and sorts pages', async () => {
    const shop = await publish();
    const a = await variant('Чашка%', 20000);
    await variant('Другая', 10000);
    const all = await request(http())
      .get('/public/products')
      .query({ sort: 'price-asc', pageSize: 1 })
      .expect(200);
    expect(all.body.total).toBe(2);
    expect(all.body.items[0].salePriceMinor).toBe(10000);
    const percent = await request(http())
      .get('/public/products')
      .query({ q: '%' })
      .expect(200);
    expect(percent.body.items.map((x: any) => x.id)).toEqual([a.id]);
    const none = await request(http())
      .get('/public/products')
      .query({ inStock: 'true' })
      .expect(200);
    expect(none.body.total).toBe(0);
    const storeSearch = await request(http())
      .get('/public/products')
      .query({ q: 'Test Shop' })
      .expect(200);
    expect(storeSearch.body.total).toBe(2);
    await request(http()).get('/public/products?pageSize=101').expect(400);
    await request(http()).get('/public/products?sort=unsafe').expect(400);
    await request(http()).get('/public/stores/nonexistent').expect(404);
    await request(http())
      .get(`/public/stores/nonexistent/products/${a.id}`)
      .expect(404);
    const r = await request(http())
      .get('/public/products')
      .query({ store: shop.slug })
      .expect(200);
    expect(r.body.total).toBe(2);
  });
  it('edits public metadata and price, hides products and shops immediately', async () => {
    const shop = await publish(),
      v = await variant();
    const edit = {
      name: 'Чашка',
      salePriceMinor: 22000,
      description: 'Керамика',
      category: 'Посуда',
      published: true,
    };
    await request(http())
      .put(`/shops/${fixture.shop}/variants/${v.id}`)
      .auth(c.cashier, { type: 'bearer' })
      .send(edit)
      .expect(403);
    await request(http())
      .put(`/shops/${fixture.otherShop}/variants/${v.id}`)
      .auth(c.owner, { type: 'bearer' })
      .send(edit)
      .expect(403);
    await request(http())
      .put(`/shops/${fixture.shop}/variants/${v.id}`)
      .auth(c.owner, { type: 'bearer' })
      .send(edit)
      .expect(200);
    const cat = await request(http())
      .get('/public/products?category=' + encodeURIComponent('Посуда'))
      .expect(200);
    expect(cat.body.total).toBe(1);
    expect(cat.body.categories).toEqual(['Посуда']);
    expect(cat.body.items[0].salePriceMinor).toBe(22000);
    await request(http())
      .put(`/shops/${fixture.shop}/variants/${v.id}`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...edit, published: false })
      .expect(200);
    await request(http())
      .get(`/public/stores/${shop.slug}/products/${v.id}`)
      .expect(404);
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, published: false })
      .expect(200);
    await request(http()).get(`/public/stores/${shop.slug}`).expect(404);
  });
  it('registers a draft store transactionally and preserves the first password on duplicate email', async () => {
    const body = {
      email: 'New@Example.test',
      password: 'partner-test-password',
      shopName: 'Новый магазин',
    };
    const r = await request(http())
      .post('/partners/register')
      .set('origin', 'http://localhost:5173')
      .send(body)
      .expect(201);
    expect(r.body).toEqual({ created: true });
    expect(r.headers['set-cookie']).toBeUndefined();
    await request(http())
      .post('/partners/register')
      .set('origin', 'http://localhost:5173')
      .send({
        ...body,
        email: 'new@example.test',
        password: 'other-test-password',
      })
      .expect(409);
    const login = await request(http())
      .post('/auth/login')
      .send({ email: 'new@example.test', password: body.password })
      .expect(201);
    const me = await request(http())
      .get('/auth/me')
      .auth(login.body.token, { type: 'bearer' })
      .expect(200);
    expect(me.body.shops).toEqual([
      { id: expect.any(String), name: body.shopName, role: 'owner' },
    ]);
    await request(http())
      .get(`/shops/${fixture.shop}/storefront`)
      .auth(login.body.token, { type: 'bearer' })
      .expect(403);
    const shops = await request(http()).get('/public/stores').expect(200);
    expect(shops.body.total).toBe(0);
    const [n] = await c.db.query('SELECT count(*)::int n FROM shops');
    expect(n.n).toBe(3);
  });
  it('rejects invalid credentials and cross-origin registration without writing records', async () => {
    const body = {
      email: 'new@example.test',
      password: 'short',
      shopName: 'Shop',
    };
    await request(http())
      .post('/partners/register')
      .set('origin', 'http://localhost:5173')
      .send(body)
      .expect(400);
    await request(http())
      .post('/partners/register')
      .set('origin', 'https://attacker.test')
      .send({ ...body, password: 'partner-test-password' })
      .expect(403);
    const [n] = await c.db.query('SELECT count(*)::int n FROM shops');
    expect(n.n).toBe(2);
  });
  it('concurrent registrations produce one owner and one shop', async () => {
    const body = {
      email: 'one@example.test',
      password: 'partner-test-password',
      shopName: 'One',
    };
    const results = await Promise.all(
      [1, 2].map(() =>
        request(http())
          .post('/partners/register')
          .set('origin', 'http://localhost:5173')
          .send(body),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const [n] = await c.db.query(
      "SELECT count(*)::int n FROM memberships WHERE role='owner'",
    );
    expect(n.n).toBe(2);
    const [s] = await c.db.query('SELECT count(*)::int n FROM shops');
    expect(s.n).toBe(3);
  });
  it('bounds registration attempts', async () => {
    for (let i = 0; i < 21; i++) {
      const r = await request(http())
        .post('/partners/register')
        .set('origin', 'http://localhost:5173')
        .send({
          email: 'owner@example.test',
          password: 'partner-test-password',
          shopName: 'Shop',
        });
      if (i === 20) expect(r.status).toBe(429);
    }
  });
  it('requires actual digits in a public phone number', async () => {
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, phone: '(((((((((' })
      .expect(400);
  });
});
