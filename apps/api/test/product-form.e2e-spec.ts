import request from 'supertest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('product creation with photo without receiving', () => {
  let ctx: Awaited<ReturnType<typeof setup>>, photo: string;
  beforeAll(async () => {
    ctx = await setup(createApp);
    photo =
      'data:image/jpeg;base64,' +
      (
        await sharp({
          create: { width: 8, height: 8, channels: 3, background: '#116b50' },
        })
          .jpeg()
          .toBuffer()
      ).toString('base64');
  });
  afterAll(async () => teardown(ctx));
  it('saves photo and description, stages moderation and creates no stock document', async () => {
    const a = await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .auth(ctx.owner, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .set('Idempotency-Key', randomUUID())
      .send({
        name: 'Принтер',
        barcode: '000123',
        salePriceMinor: 200000,
        photoDataUrl: photo,
        description: 'Фото принтера',
        category: 'Другое',
      })
      .expect(201);
    expect(a.body.photoUrl).toBe(
      `/api/shops/${fixture.shop}/variants/${a.body.id}/photo`,
    );
    expect(a.body.description).toBe('Фото принтера');
    expect(a.body.publicationStatus).toBe('pending');
    await request(ctx.app.getHttpServer())
      .get(`/shops/${fixture.shop}/variants/${a.body.id}/photo`)
      .auth(ctx.owner, { type: 'bearer' })
      .expect(200)
      .expect('Content-Type', /image\/jpeg/);
    const [counts] = await ctx.db.query(
      'SELECT (SELECT count(*)::int FROM stock_documents) documents,(SELECT count(*)::int FROM stock_movements) movements,(SELECT count(*)::int FROM stock_balances) balances',
    );
    expect(counts).toEqual({ documents: 0, movements: 0, balances: 0 });
  });
  it('rejects malformed photo before inserting a card', async () => {
    const before = await ctx.db.query('SELECT count(*)::int n FROM variants');
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .auth(ctx.owner, { type: 'bearer' })
      .send({
        name: 'Bad',
        salePriceMinor: 100,
        photoDataUrl: 'data:image/jpeg;base64,not-an-image',
      })
      .expect(400);
    expect(await ctx.db.query('SELECT count(*)::int n FROM variants')).toEqual(
      before,
    );
  });
  it('cashier cannot create a card with photo', async () => {
    await request(ctx.app.getHttpServer())
      .post(`/shops/${fixture.shop}/variants`)
      .auth(ctx.cashier, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Denied', salePriceMinor: 100, photoDataUrl: photo })
      .expect(403);
  });
});
