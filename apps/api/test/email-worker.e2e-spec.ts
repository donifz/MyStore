import { createApp } from '../src/app';
import { setup, teardown } from './helpers';
import { EmailQueueService } from '../src/email/email-queue.service';
import { EmailWorker, stopEmailWorker } from '../src/email/email-worker';
describe('leased email delivery', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  let q: EmailQueueService;
  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries');
    q = new EmailQueueService(c.db);
  });
  afterEach(async () => {
    await teardown(c);
  });
  async function enqueue(key: string) {
    return c.db.transaction((tx) =>
      q.enqueue(
        tx,
        key,
        { to: 'a@example.test', subject: 'Hello', text: 'body' },
        null,
      ),
    );
  }
  it('two workers claim a delivery once and mark SMTP acceptance', async () => {
    await enqueue('one');
    const sent: string[] = [];
    const transport = {
      send: async (_: any, id: string) => {
        sent.push(id);
      },
    };
    await Promise.all([
      new EmailWorker(c.db, transport).tick(),
      new EmailWorker(c.db, transport).tick(),
    ]);
    expect(sent).toHaveLength(1);
    expect(
      (await c.db.query('SELECT status FROM email_deliveries'))[0].status,
    ).toBe('sent');
  });
  it('recovers lease with the same Message-ID after unknown result', async () => {
    const id = await enqueue('one');
    const [before] = await c.db.query(
      'SELECT message_id FROM email_deliveries WHERE id=$1',
      [id],
    );
    await c.db.query(
      "UPDATE email_deliveries SET status='sending',lease_until=now()-interval '1 second',lease_token=gen_random_uuid()",
    );
    const sent: string[] = [];
    await new EmailWorker(c.db, {
      send: async (_: any, m: string) => {
        sent.push(m);
      },
    }).tick();
    expect(sent).toEqual([before.message_id]);
  });
  it('backs off on failure and terminates after sixth error without leaking errors', async () => {
    await enqueue('one');
    const worker = new EmailWorker(c.db, {
      send: async () => {
        throw new Error('password-and-token-secret');
      },
    });
    for (let n = 1; n <= 6; n++) {
      await c.db.query(
        "UPDATE email_deliveries SET available_at=now()-interval '1 second'",
      );
      await worker.tick();
      const [row] = await c.db.query('SELECT * FROM email_deliveries');
      expect(row.attempts).toBe(n);
      expect(row.last_error).not.toContain('secret');
      if (n < 6) {
        expect(row.status).toBe('pending');
        expect(new Date(row.available_at).getTime()).toBeGreaterThan(
          Date.now(),
        );
      } else expect(row.status).toBe('failed');
    }
  });
  it('shutdown drains only the current send and leaves the next delivery pending', async () => {
    await enqueue('first');
    await enqueue('second');
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      ready = new Promise<void>((r) => (started = r));
    const sent: string[] = [];
    const worker = new EmailWorker(c.db, {
      send: async (_m, id) => {
        sent.push(id);
        started();
        await gate;
      },
    });
    const running = worker.tick();
    await ready;
    const stopping = stopEmailWorker(worker, running);
    release();
    await stopping;
    expect(sent).toHaveLength(1);
    expect(
      (
        await c.db.query(
          "SELECT count(*)::int n FROM email_deliveries WHERE status='pending'",
        )
      )[0].n,
    ).toBe(1);
  });

  it('erases expired sensitive messages even when their backoff is not due', async () => {
    const before = process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
    process.env.EMAIL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
      'base64',
    );
    try {
      const [reset] = await c.db.query(
        "INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES($1,repeat('a',64),now()-interval '1 minute') RETURNING id",
        ['33333333-3333-4333-8333-333333333333'],
      );
      const id = await c.db.transaction((tx) =>
        q.enqueue(
          tx,
          'expired',
          {
            to: 'a@example.test',
            subject: 'Reset',
            text: 'secret',
            secret: { kind: 'reset', referenceId: reset.id },
          },
          null,
        ),
      );
      await c.db.query(
        "UPDATE email_deliveries SET available_at=now()+interval '4 hours' WHERE id=$1",
        [id],
      );
      await new EmailWorker(c.db, {
        send: async () => {
          throw new Error('expired message must not be sent');
        },
      }).tick();
      const [row] = await c.db.query(
        'SELECT status,encrypted_payload FROM email_deliveries WHERE id=$1',
        [id],
      );
      expect(row).toEqual({ status: 'cancelled', encrypted_payload: null });
    } finally {
      if (before === undefined) delete process.env.EMAIL_TOKEN_ENCRYPTION_KEY;
      else process.env.EMAIL_TOKEN_ENCRYPTION_KEY = before;
    }
  });
});
