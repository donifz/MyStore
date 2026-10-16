import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('product photo album moderation', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const http = () => c.app.getHttpServer();
  let photos: string[];

  beforeAll(async () => {
    c = await setup(createApp);
    photos = await Promise.all(
      ['#e04a38', '#286fcb'].map(async (background) => {
        const bytes = await sharp({
          create: { width: 8, height: 8, channels: 3, background },
        })
          .jpeg()
          .toBuffer();
        return 'data:image/jpeg;base64,' + bytes.toString('base64');
      }),
    );
  });
  afterAll(async () => teardown(c));

  it('preserves approved photos until reordered album is approved', async () => {
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
        .send({
          name: 'Альбом',
          salePriceMinor: 15000,
          photoDataUrls: photos,
        })
        .expect(201)
    ).body;
    const path = `/public/stores/${shop.slug}/products/${variant.id}`;
    await request(http()).get(path).expect(404);
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [
      fixture.owner,
    ]);
    async function approve() {
      const queue = (
        await request(http())
          .get('/platform/admin/products')
          .auth(c.owner, { type: 'bearer' })
          .expect(200)
      ).body.items;
      expect(queue).toHaveLength(1);
      await request(http())
        .post(
          `/platform/admin/products/revisions/${queue[0].revision_id}/decision`,
        )
        .auth(c.owner, { type: 'bearer' })
        .send({ decision: 'approved' })
        .expect(201);
    }
    await approve();
    const first = (await request(http()).get(path).expect(200)).body;
    expect(first.photoUrls).toHaveLength(2);
    const main = await request(http()).get(first.photoUrls[0]).expect(200);
    const secondary = await request(http())
      .get(first.photoUrls[1])
      .expect(200);
    expect(main.body.equals(secondary.body)).toBe(false);

    await request(http())
      .put(`/shops/${fixture.shop}/variants/${variant.id}/photos`)
      .auth(c.cashier, { type: 'bearer' })
      .send({ photoDataUrls: [photos[1], photos[0]] })
      .expect(403);
    await request(http())
      .put(`/shops/${fixture.shop}/variants/${variant.id}/photos`)
      .auth(c.owner, { type: 'bearer' })
      .send({ photoDataUrls: [photos[1], photos[0]] })
      .expect(200);

    const pending = await request(http()).get(first.photoUrls[0]).expect(200);
    expect(pending.body.equals(main.body)).toBe(true);
    await approve();
    const reordered = await request(http()).get(first.photoUrls[0]).expect(200);
    expect(reordered.body.equals(secondary.body)).toBe(true);

    await request(http())
      .put(`/shops/${fixture.shop}/variants/${variant.id}/photos`)
      .auth(c.owner, { type: 'bearer' })
      .send({ photoDataUrls: Array(9).fill(photos[0]) })
      .expect(400);
    expect(
      (await request(http()).get(path).expect(200)).body.photoUrls,
    ).toHaveLength(2);
  });
});
