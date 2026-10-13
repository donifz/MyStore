import { buildDataSource } from '../database';
import { readEmailConfig } from '../email/email-config';
import { SmtpTransport } from '../email/smtp-transport';
import { EventEmailService } from '../email/event-email.service';
import { EmailQueueService } from '../email/email-queue.service';
import { EmailWorker, stopEmailWorker } from '../email/email-worker';
async function main() {
  if (!readEmailConfig().enabled) {
    console.log('Email worker disabled');
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  const transport = new SmtpTransport();
  const worker = new EmailWorker(db, transport);
  const events = new EventEmailService(db, new EmailQueueService(db));
  let running: Promise<void> | null = null;
  let stopping = false;
  const tick = () => {
    if (stopping) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      await events.expandBatch();
      await worker.tick();
    })().finally(() => {
      running = null;
    });
    return running;
  };
  const timer = setInterval(() => {
    void tick().catch(() => console.error('Email worker batch failed'));
  }, 5000);
  const close = async () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    await stopEmailWorker(worker, running);
    transport.close();
    await db.destroy();
  };
  process.once('SIGTERM', () => {
    void close();
  });
  process.once('SIGINT', () => {
    void close();
  });
  await tick();
}
main().catch(() => {
  console.error(
    'Email worker startup failed: check SMTP configuration and database',
  );
  process.exitCode = 1;
});
