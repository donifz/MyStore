import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('product publication review', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const http = () => c.app.getHttpServer();
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  it('keeps new and edited editorial copy behind review while prices remain live', async () => {
    const shop = (
      await request(http())
        .put(`/shops/${fixture.shop}/storefront`)
        .auth(c.owner, { type: 'bearer' })
        .send({
          description: '',
          city: 'Ош',
          address: '',
          phone: '+996700123456',
          hours: '',
          published: true,
        })
        .expect(200)
    ).body;
    const variant = (
      await request(http())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ name: 'Чашка', salePriceMinor: 10000 })
        .expect(201)
    ).body;
    await request(http())
      .get(`/public/stores/${shop.slug}/products/${variant.id}`)
      .expect(404);
    await request(http())
      .get('/platform/admin/products')
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      fixture.owner,
    ]);
    const queue = (
      await request(http())
        .get('/platform/admin/products')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(queue.items).toHaveLength(1);
    expect(JSON.stringify(queue)).not.toContain('unitCostMinor');
    const id = queue.items[0].revision_id;
    await request(http())
      .post(`/platform/admin/products/revisions/${id}/decision`)
      .auth(c.owner, { type: 'bearer' })
      .send({ decision: 'approved' })
      .expect(201);
    await request(http())
      .post(`/platform/admin/products/revisions/${id}/decision`)
      .auth(c.owner, { type: 'bearer' })
      .send({ decision: 'approved' })
      .expect(409);
    const product = `/public/stores/${shop.slug}/products/${variant.id}`;
    expect((await request(http()).get(product).expect(200)).body.name).toBe(
      'Чашка',
    );
    await request(http())
      .put(`/shops/${fixture.shop}/variants/${variant.id}`)
      .auth(c.owner, { type: 'bearer' })
      .send({
        name: 'Новая чашка',
        description: 'Керамика',
        category: '',
        salePriceMinor: 12000,
        published: true,
      })
      .expect(200);
    const unchanged = (await request(http()).get(product).expect(200)).body;
    expect(unchanged).toMatchObject({
      name: 'Чашка',
      description: '',
      salePriceMinor: 12000,
    });
    const next = (
      await request(http())
        .get('/platform/admin/products')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body.items[0];
    await request(http())
      .post(`/platform/admin/products/revisions/${next.revision_id}/decision`)
      .auth(c.owner, { type: 'bearer' })
      .send({ decision: 'rejected', reason: 'Неверная категория' })
      .expect(201);
    expect((await request(http()).get(product).expect(200)).body.name).toBe(
      'Чашка',
    );
    const audit = (
      await request(http())
        .get('/platform/admin/audit')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(audit.items.filter((i: any) => i.kind === 'product')).toHaveLength(
      2,
    );
  });
  it('paginates all pending products and searches beyond the first page', async () => {
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      fixture.owner,
    ]);
    for (let index = 1; index <= 12; index++) {
      await request(http())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({
          name: index === 12 ? 'Особенная игрушка' : `Игрушка ${index}`,
          salePriceMinor: 10000,
        })
        .expect(201);
    }
    const first = (
      await request(http())
        .get('/platform/admin/products?page=1&pageSize=10')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    const second = (
      await request(http())
        .get('/platform/admin/products?page=2&pageSize=10')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(first.total).toBe(12);
    expect(first.items).toHaveLength(10);
    expect(second.total).toBe(12);
    expect(second.items).toHaveLength(2);
    expect(
      new Set([...first.items, ...second.items].map((item: any) => item.revision_id))
        .size,
    ).toBe(12);

    const found = (
      await request(http())
        .get('/platform/admin/products?page=1&pageSize=10&q=%D0%9E%D1%81%D0%BE%D0%B1%D0%B5%D0%BD%D0%BD%D0%B0%D1%8F')
        .auth(c.owner, { type: 'bearer' })
        .expect(200)
    ).body;
    expect(found.total).toBe(1);
    expect(found.items[0].name).toBe('Особенная игрушка');
  });

});
