import { Client } from 'pg';
import { scryptSync, randomBytes } from 'node:crypto';
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test'))
    throw new Error(
      'Browser tests require dedicated TEST_DATABASE_URL ending _test',
    );
  const password = 'browser-test-password';
  const salt = randomBytes(16).toString('hex');
  const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
  const db = new Client({ connectionString: url });
  await db.connect();
  try {
    await db.query('TRUNCATE shops,users CASCADE');
    await db.query(
      "INSERT INTO shops(id,name) VALUES('11111111-1111-4111-8111-111111111111','MyStore Demo')",
    );
    await db.query(
      'INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3),($4,$5,$3)',
      [
        '33333333-3333-4333-8333-333333333333',
        'owner@example.test',
        hash,
        '44444444-4444-4444-8444-444444444444',
        'cashier@example.test',
      ],
    );
    await db.query(
      "INSERT INTO memberships(shop_id,user_id,role) VALUES('11111111-1111-4111-8111-111111111111','33333333-3333-4333-8333-333333333333','owner'),('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444','cashier')",
    );
    await db.query(
      "INSERT INTO platform_admins(user_id) VALUES('33333333-3333-4333-8333-333333333333')",
    );
  } finally {
    await db.end();
  }
}
