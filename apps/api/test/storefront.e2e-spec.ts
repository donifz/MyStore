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
        .send({ name, salePriceMinor: price })
        .expect(201)
    ).body;
    await approveTestProduct(c.db, item.id);
    return item;
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
      size: '',
      color: '',
      sku: v.sku,
      name: 'Чашка%',
      description: '',
      category: '',
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
