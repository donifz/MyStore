import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import request from 'supertest';

describe('shop access', () => {
  let ctx: Awaited<ReturnType<typeof setup>>;
  beforeAll(async () => {
    ctx = await setup(createApp);
  });
  afterAll(async () => {
    await teardown(ctx);
  });
  test('ownerCanAccessOwnShop', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/access`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(200);
  });
  test('foreignShopIsForbidden', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.otherShop}/access`)
      .set('Authorization', `Bearer ${ctx.owner}`)
      .expect(403);
  });
  test('anonymousIsUnauthorized', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/access`)
      .expect(401);
  });
  test('cashierCannotReceiveStock', async () => {
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/access?permission=receive`)
      .set('Authorization', `Bearer ${ctx.cashier}`)
      .expect(403);
  });
  test('login failures do not enumerate accounts', async () => {
    const a = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.test', password: 'wrong' })
      .expect(401);
    const b = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'missing@example.test', password: 'wrong' })
      .expect(401);
    expect(a.body.message).toBe(b.body.message);
  });
  test('revoked session is unauthorized', async () => {
    const login = await request(ctx.app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'owner@example.test', password: 'correct-test-password' })
      .expect(201);
    await request(ctx.app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(201);
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/access`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(401);
  });
});
