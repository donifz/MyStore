import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../src/app';
import type { RequestHandler } from 'express';

describe('public Next handler boundary', () => {
  let app: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    const handler: RequestHandler = (req, res) => {
      res
        .status(req.path.includes('missing') ? 404 : 200)
        .type('html')
        .send('<h1>Server-rendered storefront</h1>');
    };
    app = await (
      createApp as (
        db: DataSource,
        handler: RequestHandler,
      ) => ReturnType<typeof createApp>
    )({} as DataSource, handler);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it.each([
    '/',
    '/shops',
    '/shops/shop-a',
    '/shops/shop-a/products/abc',
    '/partner',
    '/_next/static/chunk.js',
    '/robots.txt',
    '/sitemap.xml',
  ])('renders public route %s via Next', async (path) => {
    const res = await request(app.getHttpServer()).get(path).expect(200);
    expect(res.text).toContain('<h1>Server-rendered storefront</h1>');
  });
  it('retains a handler404 for a missing product', async () => {
    await request(app.getHttpServer())
      .get('/shops/missing/products/abc')
      .expect(404);
  });
  it.each([
    '/api/auth/me',
    '/auth/me',
    '/api/shops/11111111-1111-4111-8111-111111111111/storefront',
    '/shops/11111111-1111-4111-8111-111111111111/storefront',
  ])('keeps private API %s outside Next', async (path) => {
    const res = await request(app.getHttpServer()).get(path).expect(401);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
