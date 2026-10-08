import request from 'supertest';
import { createApp } from '../src/app';
import { AuthService } from '../src/auth/auth.service';
import { setup, teardown, fixture } from './helpers';
describe('browser sessions', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  const origin = 'http://localhost:5173';
  const credentials = {
    email: 'owner@example.test',
    password: 'correct-test-password',
  };
  it('authenticates with HttpOnly cookie and revokes it on logout', async () => {
    const agent = request.agent(c.app.getHttpServer());
    const login = await agent
      .post('/auth/web/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    expect(login.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(login.body.token).toBeUndefined();
    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.userId).toBe(fixture.owner);
    expect(me.body.shops).toEqual([
      { id: fixture.shop, name: 'Test Shop', role: 'owner' },
    ]);
    await agent
      .post('/auth/web/logout')
      .set('Origin', origin)
      .set('x-csrf-token', me.body.csrfToken)
      .expect(201);
    await agent.get('/auth/me').expect(401);
  });
  it('rejects login origins and unsafe cookie requests without CSRF', async () => {
    await request(c.app.getHttpServer())
      .post('/auth/web/login')
      .send(credentials)
      .expect(403);
    await request(c.app.getHttpServer())
      .post('/auth/web/login')
      .set('Origin', 'https://evil.test')
      .send(credentials)
      .expect(403);
    const agent = request.agent(c.app.getHttpServer());
    const login = await agent
      .post('/auth/web/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    await agent.post('/auth/web/logout').set('Origin', origin).expect(403);
    await agent
      .post('/auth/web/logout')
      .set('Origin', 'https://evil.test')
      .set('x-csrf-token', login.body.csrfToken)
      .expect(403);
  });
  it('expired session is rejected while bearer still works', async () => {
    const agent = request.agent(c.app.getHttpServer());
    await agent
      .post('/auth/web/login')
      .set('Origin', origin)
      .send(credentials)
      .expect(201);
    await c.db.query(
      "UPDATE sessions SET expires_at=now()-interval '1 second'",
    );
    await agent.get('/auth/me').expect(401);
    const token = (
      await request(c.app.getHttpServer())
        .post('/auth/login')
        .send(credentials)
        .expect(201)
    ).body.token;
    await request(c.app.getHttpServer())
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
  });
  it('limits one account without prematurely blocking other users behind the same IP', () => {
    const auth = c.app.get(AuthService);
    for (let i = 0; i < 20; i++)
      auth.limitLogin('shared-office-ip', 'owner@example.test');
    expect(() =>
      auth.limitLogin('shared-office-ip', 'owner@example.test'),
    ).toThrow('Too many attempts');
    expect(() =>
      auth.limitLogin('shared-office-ip', 'cashier@example.test'),
    ).not.toThrow();
  });
});
