import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('shop customers and separate buyer accounts', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  const shopRoot = `/shops/${fixture.shop}/customers`;

  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE buyer_accounts CASCADE');
  });
  afterEach(async () => {
    await teardown(c);
  });

  it('creates customers in one shop only and rejects duplicate numbers', async () => {
    const person = {
      name: 'Азамат',
      phone: '0700 123 456',
      address: 'Ош',
    };
    const created = await request(c.app.getHttpServer())
      .post(shopRoot)
      .auth(c.cashier, { type: 'bearer' })
      .send(person)
      .expect(201);
    expect(created.body.phone).toBe('+996700123456');

    await request(c.app.getHttpServer())
      .post(shopRoot)
      .auth(c.owner, { type: 'bearer' })
      .send({ ...person, phone: '+996700123456' })
      .expect(409);

    const list = await request(c.app.getHttpServer())
      .get(shopRoot + '?q=700&page=1&pageSize=10')
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.total).toBe(1);

    await request(c.app.getHttpServer())
      .get(`/shops/${fixture.otherShop}/customers`)
      .auth(c.cashier, { type: 'bearer' })
      .expect(403);
    await request(c.app.getHttpServer())
      .get(shopRoot)
      .expect(401);
    await request(c.app.getHttpServer())
      .get(shopRoot + '/' + created.body.id)
      .auth(c.cashier, { type: 'bearer' })
      .expect(200);
  });

  it('does not grant debts or shop membership by matching an unverified phone', async () => {
    const app = c.app.getHttpServer();
    await request(app)
      .post(shopRoot)
      .auth(c.owner, { type: 'bearer' })
      .send({ name: 'Cashier-created customer', phone: '+996555123456' })
      .expect(201);

    await request(app)
      .post('/buyer/register')
      .set('Origin', 'http://localhost:5173')
      .send({
        name: 'Another person',
        phone: '0555 123 456',
        password: 'a-long-test-password',
      })
      .expect(201);

    const buyer = request.agent(app);
    const login = await buyer.post('/buyer/login')
      .set('Origin', 'http://localhost:5173')
      .send({ phone: '996555123456', password: 'a-long-test-password' })
      .expect(201);
    expect(login.body.csrfToken).toMatch(/^[0-9a-f]{64}$/);
    const me = await buyer.get('/buyer/me').expect(200);
    expect(me.body.phone).toBe('+996555123456');
    expect(me.body.phoneVerified).toBe(false);
    expect(me.body.shops).toEqual([]);
    expect(me.body).not.toHaveProperty('password_hash');

    await buyer.post('/buyer/logout')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', login.body.csrfToken)
      .send({})
      .expect(201);
    await buyer.get('/buyer/me').expect(401);
  });

  it('rejects non-Kyrgyz numbers and unauthenticated customer records', async () => {
    await request(c.app.getHttpServer())
      .post('/buyer/register')
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'Buyer', phone: '+77001234567', password: 'long-enough-secret' })
      .expect(400);
    await request(c.app.getHttpServer())
      .post(shopRoot)
      .auth(c.owner, { type: 'bearer' })
      .send({ name: 'Buyer', phone: '12345' })
      .expect(400);
  });
});
