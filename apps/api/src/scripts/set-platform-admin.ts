import { buildDataSource } from '../database';

async function run() {
  const [action, rawEmail, confirmation] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (
    !['grant', 'revoke'].includes(action) ||
    !email ||
    confirmation !== `--confirm=${email}`
  )
    throw new Error(
      'Usage: set-platform-admin grant|revoke user@example.com --confirm=user@example.com',
    );
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
  const db = buildDataSource(process.env.DATABASE_URL);
  await db.initialize();
  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.query(
        'SELECT id FROM users WHERE email=$1 FOR UPDATE',
        [email],
      );
      if (!user) throw new Error('User not found');
      if (action === 'grant') {
        await tx.query(
          'INSERT INTO platform_admins(user_id) VALUES($1) ON CONFLICT DO NOTHING',
          [user.id],
        );
      } else {
        const [count] = await tx.query(
          'SELECT count(*)::int AS total FROM platform_admins',
        );
        if (Number(count.total) < 2)
          throw new Error('Cannot revoke the last platform administrator');
        await tx.query('DELETE FROM platform_admins WHERE user_id=$1', [
          user.id,
        ]);
      }
    });
    console.log(`Platform administrator ${action} completed for ${email}`);
  } finally {
    await db.destroy();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
