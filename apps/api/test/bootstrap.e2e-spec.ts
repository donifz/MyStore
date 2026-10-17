import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app';
import { setup, teardown } from './helpers';
const exec = promisify(execFile);
describe('initial deployment owner', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
  });
  afterEach(async () => {
    await teardown(c);
  });
  function run(vars: Record<string, string> = {}) {
    return exec(
      process.execPath,
      [resolve(__dirname, '../dist/scripts/bootstrap.js')],
      {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          NODE_ENV: 'production',
          BOOTSTRAP_OWNER_EMAIL: 'admin@mystore.test',
          BOOTSTRAP_OWNER_PASSWORD: 'random-initial-password-strong',
          BOOTSTRAP_SHOP_NAME: 'MyStore',
          ...vars,
        },
      },
    );
  }
  it('creates the first owner once under concurrent starts without resetting their password', async () => {
    await c.db.query('TRUNCATE shops,users CASCADE');
    await Promise.all([run(), run()]);
    const login = await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@mystore.test',
        password: 'random-initial-password-strong',
      })
      .expect(201);
    const me = await request(c.app.getHttpServer())
      .get('/auth/me')
      .auth(login.body.token, { type: 'bearer' })
      .expect(200);
    expect(me.body.shops).toEqual([
      {
        id: expect.any(String),
        name: 'MyStore',
        role: 'owner',
        canReturn: true,
        canViewReports: true,
      },
    ]);
    await run({ BOOTSTRAP_OWNER_PASSWORD: 'different-strong-password' });
    await request(c.app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@mystore.test',
        password: 'different-strong-password',
      })
      .expect(401);
    const [count] = await c.db.query('SELECT count(*)::int AS n FROM users');
    expect(count.n).toBe(1);
  });
  it('does not add an initial owner to an already populated database', async () => {
    await run();
    const rows = await c.db.query('SELECT email FROM users WHERE email=$1', [
      'admin@mystore.test',
    ]);
    expect(rows).toEqual([]);
  });
  it('rejects partial or weak initial credentials without leaving a shop behind', async () => {
    await c.db.query('TRUNCATE shops,users CASCADE');
    await expect(run({ BOOTSTRAP_OWNER_PASSWORD: 'short' })).rejects.toThrow(
      'Initial owner requires',
    );
    await expect(run({ BOOTSTRAP_OWNER_EMAIL: '' })).rejects.toThrow(
      'Initial owner requires',
    );
    const [count] = await c.db.query('SELECT count(*)::int AS n FROM shops');
    expect(count.n).toBe(0);
  });
  it('is optional when initial credentials are absent', async () => {
    await c.db.query('TRUNCATE shops,users CASCADE');
    await run({
      BOOTSTRAP_OWNER_EMAIL: '',
      BOOTSTRAP_OWNER_PASSWORD: '',
      BOOTSTRAP_SHOP_NAME: '',
    });
    const [count] = await c.db.query('SELECT count(*)::int AS n FROM users');
    expect(count.n).toBe(0);
  });
});
