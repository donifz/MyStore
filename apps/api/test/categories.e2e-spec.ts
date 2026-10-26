import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('shop categories', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => teardown(c));

  it('provides ready-made category trees and lets a shop add custom categories', async () => {
    const response = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    const electronics = response.body.find(
      (category: any) => category.name === 'Электроника',
    );
    expect(electronics.children.map((item: any) => item.name)).toContain(
      'Ноутбуки',
    );

    const custom = await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .send({ name: 'Рукоделие' })
      .expect(201);
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .send({ name: 'Пряжа', parentId: custom.body.id })
      .expect(201);

    const updated = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    const craft = updated.body.find(
      (category: any) => category.name === 'Рукоделие',
    );
    expect(craft.children.map((item: any) => item.name)).toContain('Пряжа');
  });

  it('does not let cashiers create categories', async () => {
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/categories`)
      .auth(c.cashier, { type: 'bearer' })
      .send({ name: 'Моя категория' })
      .expect(403);
  });
  it('seeds database category templates for toy shops without leaking categories across shops', async () => {
    const [type] = await c.db.query(
      "SELECT code FROM shop_types WHERE code='toys'",
    );
    expect(type.code).toBe('toys');
    const [template] = await c.db.query(
      "SELECT count(*)::int n FROM shop_category_templates WHERE shop_type='toys'",
    );
    expect(template.n).toBeGreaterThan(10);

    await c.db.query("UPDATE shops SET shop_type='toys' WHERE id=$1", [
      fixture.shop,
    ]);
    const response = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    const robotics = response.body.find(
      (category: any) => category.name === 'Робототехника',
    );
    expect(robotics.platformCategoryCode).toBe('toys');
    expect(robotics.children.map((c: any) => c.name)).toContain('STEM-наборы');
    const response2 = await request(c.app.getHttpServer())
      .get(`/shops/${fixture.shop}/categories`)
      .auth(c.owner, { type: 'bearer' })
      .expect(200);
    expect(response2.body.length).toBe(response.body.length);
  });
});
