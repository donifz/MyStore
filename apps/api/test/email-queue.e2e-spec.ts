import { createApp } from '../src/app';
import { setup, teardown } from './helpers';
import { EmailQueueService } from '../src/email/email-queue.service';
import { readEmailConfig } from '../src/email/email-config';
describe('transactional email queue', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries');
  });
  afterEach(async () => {
    await teardown(c);
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
  });
  it('deduplicates committed delivery and rolls back with caller transaction', async () => {
    const q = new EmailQueueService(c.db);
    const m = { to: 'a@example.test', subject: 'Hello', text: 'message' };
    await c.db.transaction(async (tx) => {
      await q.enqueue(tx, 'one', m, null);
      await q.enqueue(tx, 'one', m, null);
    });
    await expect(
      c.db.transaction(async (tx) => {
        await q.enqueue(tx, 'two', m, null);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');
    expect(
      (await c.db.query('SELECT count(*)::int n FROM email_deliveries'))[0].n,
    ).toBe(1);
  });
  it('encrypts secret messages and rejects malformed encryption configuration', async () => {
    const q = new EmailQueueService(c.db);
    await c.db.transaction((tx) =>
      q.enqueue(
        tx,
        'secret',
        {
          to: 'a@example.test',
          subject: 'Invite',
          text: 'token-secret-value',
          secret: {
            kind: 'staff',
            referenceId: '11111111-1111-4111-8111-111111111111',
          },
        },
        null,
      ),
    );
    const [row] = await c.db.query('SELECT * FROM email_deliveries');
    expect(JSON.stringify(row)).not.toContain('token-secret-value');
    expect(q.decode(row).text).toBe('token-secret-value');
    delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    await expect(
      c.db.transaction((tx) =>
        q.enqueue(
          tx,
          'bad',
          {
            to: 'a@example.test',
            subject: 'Invite',
            text: 'secret',
            secret: {
              kind: 'reset',
              referenceId: '11111111-1111-4111-8111-111111111111',
            },
          },
          null,
        ),
      ),
    ).rejects.toThrow();
  });
  it('does not require SMTP credentials when disabled, validates enabled configuration', () => {
    expect(readEmailConfig({}).enabled).toBe(false);
    expect(() => readEmailConfig({ EMAIL_ENABLED: 'true' })).toThrow();
  });
  it('rejects mail header injection', async () => {
    await expect(
      c.db.transaction((tx) =>
        new EmailQueueService(c.db).enqueue(
          tx,
          'bad',
          {
            to: 'a@example.test\r\nBcc: evil@example.test',
            subject: 'Hi',
            text: 'hello',
          },
          null,
        ),
      ),
    ).rejects.toThrow();
  });
  it('accepts valid quoted mailbox addresses accepted by checkout validation', async () => {
    const q = new EmailQueueService(c.db);
    await c.db.transaction((tx) =>
      q.enqueue(
        tx,
        'quoted',
        { to: '"a b"@example.test', subject: 'Hello', text: 'body' },
        null,
      ),
    );
    expect(
      (await c.db.query('SELECT recipient FROM email_deliveries'))[0].recipient,
    ).toBe('"a b"@example.test');
  });
});
