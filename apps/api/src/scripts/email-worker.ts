import { closeResources } from '../shutdown';
import { buildDataSource } from '../database';
import { readEmailConfig } from '../email/email-config';
import { createEmailTransport } from '../email/email-transport';
import { EmailRunner } from '../email/email-runner';
async function main() {
  if (!readEmailConfig().enabled) {
    console.log('Email worker disabled');
    return;
  }
  if (process.env.EMAIL_WORKER_MODE === 'inline')
    throw new Error('Email already configured inside API');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  const runner = new EmailRunner(db, createEmailTransport());
  let stopping = false;
  const close = async () => {
    if (stopping) return;
    stopping = true;
    process.exitCode = await closeResources([
      () => runner.stop(),
      () => db.destroy(),
    ]);
  };
  process.once('SIGTERM', () => {
    void close();
  });
  process.once('SIGINT', () => {
    void close();
  });
  runner.start();
}
main().catch(() => {
  console.error(
    'Email worker startup failed: check email configuration and database',
  );
  process.exitCode = 1;
});
