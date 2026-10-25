import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('variants', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  let id: string;
  beforeAll(async () => {
    ctx = await setup(createApp);
  });
  afterAll(async () => teardown(ctx));
  const payload = {
    name: 'Bag',
    barcode: '0012345678905',
    salePriceMinor: 15000,
  };
  test('preserves leading zeroes and creates no stock', async () => {
    const r = await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    id = r.body.id;
    const found = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants/by-barcode?code=0012345678905`)
      .set('Authorization', `Bearer ${ctx.cashier}`)
      .expect(200);
    expect(found.body.barcode).toBe('0012345678905');
    expect(found.body.id).toBe(id);
    expect(found.body).not.toHaveProperty('unitCostMinor');
  });
  test('duplicate barcode is rejected in own shop', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(409);
  });
  test('same barcode is allowed in another shop', async () => {
    await ctx.db.query(
      "INSERT INTO memberships(shop_id,user_id,role)VALUES($1,$2,'owner')",
      [fixture.otherShop, fixture.owner],
    );
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.otherShop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload)
      .expect(201);
    await ctx.db.query('DELETE FROM memberships WHERE shop_id=$1', [
      fixture.otherShop,
    ]);
  });
  test.each([
    { ...payload, name: '' },
    { ...payload, barcode: '' },
    { ...payload, salePriceMinor: -1 },
    { ...payload, salePriceMinor: 1.5 },
  ])('rejects invalid variant %j', async (body) => {
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send(body)
      .expect(400);
  });
  test('foreign variant lookup is forbidden', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.otherShop}/variants/by-barcode?code=0012345678905`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(403);
  });
  test('cashier cannot create variant', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.cashier}`)
      .set('Idempotency-Key', randomUUID())
      .send({ ...payload, barcode: 'OTHER' })
      .expect(403);
  });
  test('generated barcode can be looked up', async () => {
    const created = await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Cup', salePriceMinor: 200 })
      .expect(201);
    const lookup = await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants/by-barcode`)
      .query({ code: created.body.barcode })
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(200);
    expect(lookup.body.id).toBe(created.body.id);
  });
});
