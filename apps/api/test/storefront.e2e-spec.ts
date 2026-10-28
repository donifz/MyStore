import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture, approveTestProduct } from './helpers';
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
    const item = (
      await request(http())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ name, salePriceMinor: price })
        .expect(201)
    ).body;
    await approveTestProduct(c.db, item.id);
    return item;
  }
  it('groups toy-store categories under global Toys while retaining local filters', async () => {
    await c.db.query("UPDATE shops SET shop_type='toys' WHERE id=$1", [
      fixture.shop,
    ]);
    await request(http())
      .get(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    const product = (
      await request(http())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({
          name: 'Робот STEM',
          salePriceMinor: 10000,
          category: 'Робототехника',
          subcategory: 'STEM-наборы',
        })
        .expect(201)
    ).body;
    await approveTestProduct(c.db, product.id);
    const shop = await publish();
    const global = await request(http())
      .get('/public/products')
      .query({ category: 'Игрушки' })
      .expect(200);
    expect(global.body.items.some((item: any) => item.id === product.id)).toBe(
      true,
    );
    expect(
      global.body.items.find((item: any) => item.id === product.id)
        .platformCategory,
    ).toBe('Игрушки');
    const local = await request(http())
      .get('/public/products')
      .query({ store: shop.slug, category: 'Робототехника' })
      .expect(200);
    expect(local.body.items.some((item: any) => item.id === product.id)).toBe(
      true,
    );
  });

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
  it('keeps a historical slug and resolves it to the canonical address', async () => {
    const first = await publish();
    const changed = await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, slug: 'canonical-home' })
      .expect(200);
    expect(changed.body.slug).toBe('canonical-home');
    await request(http())
      .get(`/public/stores/${first.slug}`)
      .expect(200)
      .expect((r) => {
        expect(r.body.slug).toBe(changed.body.slug);
        expect(r.body.historical).toBe(true);
      });
    await request(http())
      .get(`/public/stores/${changed.body.slug}`)
      .expect(200)
      .expect((r) => expect(r.body.slug).toBe('canonical-home'));
    const alias = await c.db.query(
      'SELECT shop_id,is_current FROM shop_slugs WHERE slug=$1',
      [first.slug],
    );
    expect(alias).toEqual([{ shop_id: fixture.shop, is_current: false }]);
    const restored = await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, slug: first.slug })
      .expect(200);
    expect(restored.body.slug).toBe(first.slug);
  });
  it('publishes a validated permanent store banner', async () => {
    const shop = await publish();
    const banner = {
      title: 'Баннер магазина',
      text: 'Выберите товары для дома',
      link: '/?category=Посуда',
      buttonLabel: 'Смотреть товары',
      imageAlt: 'Посуда на столе',
    };
    const saved = await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, banner })
      .expect(200);
    expect(saved.body.banner).toEqual(banner);
    const publicStore = await request(http())
      .get(`/public/stores/${shop.slug}`)
      .expect(200);
    expect(publicStore.body.banner).toEqual(banner);

    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, banner: { ...banner, link: 'javascript:alert(1)' } })
      .expect(400);
    const unchanged = await request(http())
      .get(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(unchanged.body.banner).toEqual(banner);
  });
  it('normalizes and validates addresses and serializes simultaneous claims', async () => {
    await publish();
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, slug: 'ab' })
      .expect(400);
    for (const slug of [
      'new',
      'cart',
      'checkout',
      'seller',
      'terms',
      'privacy',
      'ui-kit',
    ])
      await request(http())
        .put(`/shops/${fixture.shop}/storefront`)
        .auth(c.owner, { type: 'bearer' })
        .send({ ...profile, slug })
        .expect(400);
    const normalized = await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, slug: 'My-New-Home' })
      .expect(200);
    expect(normalized.body.slug).toBe('my-new-home');

    await c.db.query(
      "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner') ON CONFLICT DO NOTHING",
      [fixture.otherShop, fixture.owner],
    );
    const claim = (shopId: string) =>
      request(http())
        .put(`/shops/${shopId}/storefront`)
        .auth(c.owner, { type: 'bearer' })
        .send({ ...profile, slug: 'shared-address' });
    const results = await Promise.all([
      claim(fixture.shop),
      claim(fixture.otherShop),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const rejected = await c.db.query(
      "SELECT action FROM audit_log WHERE action='slug_change_rejected'",
    );
    expect(rejected).toHaveLength(1);
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
      size: '',
      color: '',
      sku: v.sku,
      name: 'Чашка%',
      description: '',
      category: '',
      platformCategory: '',
      salePriceMinor: 15000,
      available: 3,
      variants: [
        {
          id: v.id,
          sku: v.sku,
          name: 'Чашка%',
          size: '',
          color: '',
          salePriceMinor: 15000,
          available: 3,
        },
      ],
      store: {
        slug: shop.slug,
        name: 'Test Shop',
        city: 'Ош',
        district: '',
        pickupEnabled: true,
        deliveryEnabled: false,
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
    const b = await variant('Другая', 10000);
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
    const skuSearch = await request(http())
      .get('/public/products')
      .query({ q: a.sku })
      .expect(200);
    expect(skuSearch.body.total).toBe(1);
    expect(skuSearch.body.items[0].id).toBe(a.id);
    expect(skuSearch.body.items[0].sku).toBe(a.sku);
    const newest = await request(http())
      .get('/public/products')
      .query({ sort: 'newest' })
      .expect(200);
    expect(newest.body.total).toBe(2);
    expect(newest.body.items[0].id).toBe(b.id);
    expect(newest.body.items[1].id).toBe(a.id);
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
    await approveTestProduct(c.db, v.id);
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
  it('requires actual digits in a public phone number', async () => {
    await request(http())
      .put(`/shops/${fixture.shop}/storefront`)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...profile, phone: '(((((((((' })
      .expect(400);
  });
});
