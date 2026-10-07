import { buildDataSource } from '../database';
import { hashPassword } from '../auth/password';
async function run() {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOW_DEMO_SEED !== 'yes'
  )
    throw new Error(
      'Demo seed requires ALLOW_DEMO_SEED=yes and non-production mode',
    );
  const password = process.env.SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('SEED_PASSWORD must contain at least 12 characters');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  try {
    const hash = await hashPassword(password);
    await db.transaction(async (tx) => {
      await tx.query(
        'INSERT INTO shops(id,name)VALUES($1,$2)ON CONFLICT DO NOTHING',
        ['11111111-1111-4111-8111-111111111111', 'Demo Store'],
      );
      await tx.query(
        'INSERT INTO users(id,email,password_hash)VALUES($1,$2,$3),($4,$5,$3)ON CONFLICT DO NOTHING',
        [
          '33333333-3333-4333-8333-333333333333',
          'owner@example.test',
          hash,
          '44444444-4444-4444-8444-444444444444',
          'cashier@example.test',
        ],
      );
      await tx.query(
        "INSERT INTO memberships(shop_id,user_id,role)VALUES($1,$2,'owner'),($1,$3,'cashier')ON CONFLICT DO NOTHING",
        [
          '11111111-1111-4111-8111-111111111111',
          '33333333-3333-4333-8333-333333333333',
          '44444444-4444-4444-8444-444444444444',
        ],
      );
    });
    console.log(
      'Demo store created; passwords of existing accounts are unchanged.',
    );
  } finally {
    await db.destroy();
  }
}
run().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
