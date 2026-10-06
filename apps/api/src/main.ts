import { buildDataSource } from './database';
import { createApp } from './app';
async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  const app = await createApp(db);
  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0');
  const close = async () => {
    await app.close();
    await db.destroy();
    process.exit(0);
  };
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
}
main().catch((e) => {
  console.error('API startup failed:', e.message);
  process.exitCode = 1;
});
