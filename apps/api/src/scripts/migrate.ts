import { buildDataSource } from '../database';
async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  try {
    await db.runMigrations();
  } finally {
    await db.destroy();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
