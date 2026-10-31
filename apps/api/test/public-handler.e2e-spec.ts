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
  it('serves install metadata and PNG icons without routing through Next', async () => {
    const login = await request(app.getHttpServer())
      .get('/seller/login')
      .expect(200);
    expect(login.headers['cache-control']).toBe('no-store');
    expect(login.text).toContain('rel="manifest"');
    const manifest = await request(app.getHttpServer())
      .get('/pwa/manifest.webmanifest')
      .expect(200);
    expect(manifest.headers['content-type']).toContain(
      'application/manifest+json',
    );
    const metadata = JSON.parse(manifest.text);
    expect(metadata).toMatchObject({
      id: '/seller',
      start_url: '/seller',
      scope: '/',
      display: 'standalone',
    });
    for (const icon of metadata.icons) {
      const response = await request(app.getHttpServer())
        .get(icon.src)
        .expect(200);
      expect(response.headers['content-type']).toContain('image/png');
      expect(response.body.subarray(1, 4).toString()).toBe('PNG');
    }
    await request(app.getHttpServer())
      .get('/pwa/apple-touch-icon.png')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/pwa/manifest.webmanifest')
      .expect(404);
    await request(app.getHttpServer()).get('/pwa/missing.png').expect(404);
  });
  it.each([
    '/',
    '/shops',
    '/shops/shop-a',
    '/shops/shop-a/products/abc',
    '/partner',
    '/cart',
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
