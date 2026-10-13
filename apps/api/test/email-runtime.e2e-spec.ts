import { createApp } from '../src/app';
import { setup, teardown, fixture } from './helpers';
import { EmailQueueService } from '../src/email/email-queue.service';
import { DataSource } from 'typeorm';
import { EmailRunner } from '../src/email/email-runner';
describe('embedded email processing', () => {
  let c: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    c = await setup(createApp);
    await c.db.query('TRUNCATE email_deliveries');
  });
  afterEach(async () => teardown(c));
  it('expands events and delivers within the existing process without a separate worker', async () => {
    await c.db.query(
      'INSERT INTO outbox_events(shop_id,topic,payload) VALUES($1,\'product.moderation\',\'{"status":"approved"}\')',
      [fixture.shop],
    );
    const messages: any[] = [];
    const runner = new EmailRunner(c.db, {
      send: async (message, id) => {
        messages.push({ message, id });
      },
      close: () => {},
    });
    await Promise.all([runner.tick(), runner.tick()]);
    await runner.stop();
    expect(messages).toHaveLength(1);
    expect(messages[0].message.to).toBe('owner@example.test');
    expect(
      (await c.db.query('SELECT status FROM email_deliveries'))[0].status,
    ).toBe('sent');
  });
  it('stops before claiming the next message and prevents further ticks', async () => {
    const queue = new EmailQueueService(c.db);
    for (const key of ['one', 'two'])
      await c.db.transaction((tx) =>
        queue.enqueue(
          tx,
          key,
          { to: 'buyer@example.test', subject: 's', text: 't' },
          null,
        ),
      );
    let ready!: () => void, release!: () => void;
    const started = new Promise<void>((r) => (ready = r)),
      gate = new Promise<void>((r) => (release = r));
    const messages: string[] = [];
    const runner = new EmailRunner(c.db, {
      send: async (_m, id) => {
        messages.push(id);
        ready();
        await gate;
      },
      close: () => {},
    });
    const running = runner.tick();
    await started;
    const stopped = runner.stop();
    release();
    await stopped;
    await running;
    await runner.tick();
    expect(messages).toHaveLength(1);
    expect(
      (
        await c.db.query(
          "SELECT count(*)::int n FROM email_deliveries WHERE status='pending'",
        )
      )[0].n,
    ).toBe(1);
  });
});

it('closes the transport when an active database operation fails during shutdown', async () => {
  let entered!: () => void, fail!: (error: Error) => void;
  const started = new Promise<void>((resolve) => (entered = resolve));
  const db = {
    transaction: async () => 0,
    query: () => {
      entered();
      return new Promise((_, reject) => (fail = reject));
    },
  } as unknown as DataSource;
  let closed = 0;
  const runner = new EmailRunner(db, {
    send: async () => {},
    close: () => {
      closed++;
    },
  });
  const running = runner.tick();
  const processing = expect(running).rejects.toThrow('database unavailable');
  await started;
  const stopped = runner.stop();
  const stopping = expect(stopped).rejects.toThrow('database unavailable');
  fail(new Error('database unavailable'));
  await Promise.all([processing, stopping]);
  expect(closed).toBe(1);
  await runner.tick();
});
