import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { buildDataSource } from '../src/database';
import { hashPassword } from '../src/auth/password';
export const fixture = {
  shop: '11111111-1111-4111-8111-111111111111',
  otherShop: '22222222-2222-4222-8222-222222222222',
  owner: '33333333-3333-4333-8333-333333333333',
  cashier: '44444444-4444-4444-8444-444444444444',
};
// Existing accounting/checkout suites use an approved public fixture.
// Moderation transitions themselves are exercised in product-moderation.e2e-spec.ts.
export async function approveTestProduct(db: DataSource, id: string) {
  await db.query(
    `INSERT INTO product_publications(variant_id,shop_id,name,description,category,subcategory,photo_data)
     SELECT id,shop_id,name,description,category,subcategory,photo_data FROM variants WHERE id=$1
     ON CONFLICT(variant_id) DO UPDATE SET name=excluded.name,description=excluded.description,
       category=excluded.category,subcategory=excluded.subcategory,photo_data=excluded.photo_data,approved_at=now()`,
    [id],
  );
}
export async function setup(
  factory: (db: DataSource) => Promise<INestApplication>,
) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error(
      'TEST_DATABASE_URL must name a dedicated database ending _test',
    );
  const db = buildDataSource(url);
  await db.initialize();
  await db.runMigrations();
  await db.query('TRUNCATE shops, users CASCADE');
  await db.query('INSERT INTO shops(id,name) VALUES($1,$2),($3,$4)', [
    fixture.shop,
    'Test Shop',
    fixture.otherShop,
    'Other Shop',
  ]);
  const hash = await hashPassword('correct-test-password');
  await db.query(
    'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3),($4,$5,$3)',
    [
      fixture.owner,
      'owner@example.test',
      hash,
      fixture.cashier,
      'cashier@example.test',
    ],
  );
  await db.query(
    "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner'),($1,$3,'cashier')",
    [fixture.shop, fixture.owner, fixture.cashier],
  );
  const app = await factory(db);
  await app.init();
  const login = async (email: string) =>
    (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'correct-test-password' })
        .expect(201)
    ).body.token as string;
  return {
    app,
    db,
    owner: await login('owner@example.test'),
    cashier: await login('cashier@example.test'),
  };
}
export async function teardown(
  ctx: { app: INestApplication; db: DataSource } | undefined,
) {
  if (ctx) {
    await ctx.app.close();
    await ctx.db.destroy();
  }
}
