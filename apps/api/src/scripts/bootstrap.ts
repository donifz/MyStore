import { randomUUID } from 'node:crypto';
import { buildDataSource } from '../database';
import { hashPassword } from '../auth/password';

async function run() {
  const email = process.env.BOOTSTRAP_OWNER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
  if (!email && !password) return;
  if (
    !email ||
    !password ||
    password.length < 16 ||
    !/^\S+@\S+\.\S+$/.test(email)
  ) {
    throw new Error(
      'Initial owner requires a valid email and password of at least 16 characters',
    );
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  try {
    await db.transaction(async (q) => {
      await q.query('SELECT pg_advisory_xact_lock(71642001)');
      const [existing] = await q.query(
        'SELECT EXISTS(SELECT 1 FROM users) OR EXISTS(SELECT 1 FROM shops) AS populated',
      );
      if (existing.populated) {
        console.log('Initial owner skipped: database already populated');
        return;
      }
      const shopId = randomUUID();
      const userId = randomUUID();
      await q.query('INSERT INTO shops(id,name) VALUES($1,$2)', [
        shopId,
        process.env.BOOTSTRAP_SHOP_NAME?.trim() || 'MyStore',
      ]);
      await q.query(
        'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)',
        [userId, email, await hashPassword(password)],
      );
      await q.query(
        "INSERT INTO memberships(shop_id,user_id,role) VALUES($1,$2,'owner')",
        [shopId, userId],
      );
      console.log('Initial owner created');
    });
  } finally {
    await db.destroy();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
