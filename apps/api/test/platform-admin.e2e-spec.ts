import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { hashPassword } from '../src/auth/password';
import { setup, teardown } from './helpers';

describe('platform administration', () => {
  let c: Awaited<ReturnType<typeof setup>>;

  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });

  it('denies a shop owner and admits an administrator without shop membership', async () => {
    const http = c.app.getHttpServer();
    await request(http)
      .get('/platform/admin/session')
      .auth(c.owner, { type: 'bearer' })
      .expect(403);
    await request(http)
      .get('/platform/admin/overview')
      .auth(c.owner, { type: 'bearer' })
      .expect(403);

    const id = randomUUID();
    await c.db.query(
      'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
      [id, 'admin@example.test', await hashPassword('correct-test-password')],
    );
    await c.db.query('INSERT INTO platform_admins(user_id) VALUES($1)', [id]);
    const login = await request(http)
      .post('/auth/login')
      .send({
        email: 'admin@example.test',
        password: 'correct-test-password',
      })
      .expect(201);
    const token = login.body.token as string;
    const me = await request(http)
      .get('/auth/me')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(me.body.shops).toEqual([]);
    expect(me.body.platformAdmin).toBe(true);
    await request(http)
      .get('/platform/admin/session')
      .auth(token, { type: 'bearer' })
      .expect(200);
    const overview = await request(http)
      .get('/platform/admin/overview')
      .auth(token, { type: 'bearer' })
      .expect(200);
    expect(overview.body.shopCount).toBeGreaterThanOrEqual(1);
    expect(overview.body).not.toHaveProperty('sales');
    expect(overview.body.shops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: expect.any(String) }),
      ]),
    );
  });
});
