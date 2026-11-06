import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';

describe('single-use buyer invitations', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE buyer_accounts CASCADE');
  });
  afterEach(async () => {
    await teardown(c);
  });

  async function customer(phone = '+996700123456') {
    const response = await request(c.app.getHttpServer())
      .post('/shops/' + fixture.shop + '/customers')
      .auth(c.cashier, { type: 'bearer' })
      .send({ name: 'Test Buyer', phone })
      .expect(201);
    return response.body.id as string;
  }

  async function buyer(phone = '+996700123456') {
    const app = c.app.getHttpServer();
    await request(app)
      .post('/buyer/register')
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'Test Buyer', phone, password: 'test-buyer-password-123' })
      .expect(201);
    const agent = request.agent(app);
    const login = await agent
      .post('/buyer/login')
      .set('Origin', 'http://localhost:5173')
      .send({ phone, password: 'test-buyer-password-123' })
      .expect(201);
    return { agent, csrf: login.body.csrfToken as string };
  }

  function issue(id: string, token = c.cashier) {
    return request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/customers/${id}/invite`)
      .auth(token, { type: 'bearer' })
      .send({});
  }

  it('only links with cashier-approved invitation and matching buyer phone', async () => {
    const id = await customer();
    const account = await buyer();
    expect((await account.agent.get('/buyer/me').expect(200)).body.shops).toEqual([]);

    await issue(id, c.owner).expect(201);
    const invitation = (await issue(id).expect(201)).body;
    expect(invitation.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invitation.expiresAt).toBeTruthy();
    expect(
      JSON.stringify(await c.db.query('SELECT token_hash FROM shop_customer_invitations')),
    ).not.toContain(invitation.token);

    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .send({ token: invitation.token })
      .expect(403);
    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', account.csrf)
      .send({ token: invitation.token })
      .expect(201);
    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', account.csrf)
      .send({ token: invitation.token })
      .expect(409);

    const me = await account.agent.get('/buyer/me').expect(200);
    expect(me.body.phoneVerified).toBe(false);
    expect(me.body.shops).toEqual([
      { shopId: fixture.shop, shopName: 'Test Shop' },
    ]);
    await issue(id).expect(409);
  });

  it('refuses a matching phone when invitation is expired or revoked', async () => {
    const id = await customer();
    const account = await buyer();
    const stale = (await issue(id).expect(201)).body.token;
    const fresh = (await issue(id).expect(201)).body.token;
    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', account.csrf)
      .send({ token: stale })
      .expect(409);

    await c.db.query(
      `UPDATE shop_customer_invitations SET expires_at=now()-interval '1 minute'
       WHERE token_hash=(SELECT token_hash FROM shop_customer_invitations
                         WHERE revoked_at IS NULL LIMIT 1)`,
    );
    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', account.csrf)
      .send({ token: fresh })
      .expect(409);
    expect((await account.agent.get('/buyer/me').expect(200)).body.shops).toEqual([]);
  });

  it('requires same number and shop authorization; no phone-based auto-link', async () => {
    const id = await customer();
    const account = await buyer('+996555123456');
    const invitation = (await issue(id).expect(201)).body;
    await account.agent
      .post('/buyer/link-shop')
      .set('Origin', 'http://localhost:5173')
      .set('x-csrf-token', account.csrf)
      .send({ token: invitation.token })
      .expect(403);

    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.otherShop}/customers/${id}/invite`)
      .auth(c.cashier, { type: 'bearer' })
      .send({})
      .expect(403);
    await request(c.app.getHttpServer())
      .post(`/shops/${fixture.shop}/customers/${id}/invite`)
      .send({})
      .expect(401);
  });
});
