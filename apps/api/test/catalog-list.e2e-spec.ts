import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('catalog list', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  it('paginates scoped items and hides cost from cashier', async () => {
    for (const [name, barcode] of [
      ['Alpha%', '00123'],
      ['Beta_', '00124'],
    ])
      await request(c.app.getHttpServer())
        .post(`/shops/${fixture.shop}/variants`)
        .auth(c.owner, { type: 'bearer' })
        .send({ name, barcode, salePriceMinor: 15000 })
        .expect(201);
    const first = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants?pageSize=1`)
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
    expect(first.body.total).toBe(2);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0]).not.toHaveProperty('stockValueMinor');
    for (const q of ['%', '_', '00123']) {
      const r = await request(c.app.getHttpServer())
        .get(`/shops/${fixture.shop}/variants`)
        .query({ q })
        .auth(c.owner, { type: 'bearer' })
        .expect(200);
      expect(r.body.total).toBe(1);
    }
    await request(c.app.getHttpServer())
      .get(`/shops/${fixture.otherShop}/variants`)
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants?pageSize=101`)
      .auth(c.owner, { type: 'bearer' })
      .expect(400);
  });
});
