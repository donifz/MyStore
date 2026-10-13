import request from 'supertest';
import { spawn, ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
describe('compiled API with Gmail inline queue', () => {
  it('handles invitation email and graceful shutdown without another service', async () => {
    const c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries');
    let child: ChildProcess | undefined;
    let exited: Promise<number | null> | undefined;
    try {
      const accepted: string[] = [];
      const script = `global.fetch=async(url,options)=>{if(String(url)==='https://oauth2.googleapis.com/token')return new Response(JSON.stringify({access_token:'test-access',expires_in:3600}));if(String(url)==='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'){process.send({raw:JSON.parse(options.body).raw});return new Response(JSON.stringify({id:'test-gmail-id'}));}throw new Error('Unexpected outbound URL');};require(${JSON.stringify(resolve(__dirname, '../dist/main.js'))});`;
      child = spawn(process.execPath, ['-e', script], {
        env: {
          ...process.env,
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          NODE_ENV: 'test',
          PORT: '43106',
          EMAIL_ENABLED: 'true',
          EMAIL_PROVIDER: 'gmail',
          EMAIL_WORKER_MODE: 'inline',
          GMAIL_FROM: 'owner@gmail.com',
          GMAIL_CLIENT_ID: 'test-client',
          GMAIL_CLIENT_SECRET: 'test-secret',
          GMAIL_REFRESH_TOKEN: 'test-refresh',
          PUBLIC_BASE_URL: 'http://127.0.0.1:43106',
          EMAIL_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      child.stdout?.on('data', () => {});
      child.stderr?.on('data', () => {});
      child.on('message', (m: any) => {
        if (typeof m.raw === 'string')
          accepted.push(Buffer.from(m.raw, 'base64url').toString());
      });
      exited = new Promise((r) => child!.once('exit', r));
      let ready = false;
      for (let i = 0; i < 60; i++) {
        if (child.exitCode !== null)
          throw new Error('Compiled API exited before ready');
        try {
          if ((await fetch('http://127.0.0.1:43106/api/health/live')).ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(ready).toBe(true);
      const email = 'inline-invite@example.test';
      await request('http://127.0.0.1:43106')
        .post(`/api/shops/${fixture.shop}/staff/invitations`)
        .auth(c.owner, { type: 'bearer' })
        .set('idempotency-key', randomUUID())
        .send({ email, role: 'cashier' })
        .expect(201);
      for (let i = 0; i < 100 && !accepted.length; i++)
        await new Promise((r) => setTimeout(r, 100));
      expect(accepted).toHaveLength(1);
      expect(accepted[0]).toContain('To: inline-invite@example.test');
      const [row] = await c.db.query(
        'SELECT status,encrypted_payload FROM email_deliveries WHERE recipient=$1',
        [email],
      );
      expect(row).toEqual({ status: 'sent', encrypted_payload: null });
      child.kill('SIGTERM');
      expect(await exited).toBe(0);
    } finally {
      if (child && child.exitCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
      await teardown(c);
    }
  }, 20000);
});
