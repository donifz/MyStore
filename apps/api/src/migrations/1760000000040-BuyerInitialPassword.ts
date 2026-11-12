import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuyerInitialPassword1760000000040 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE buyer_accounts
      ADD COLUMN IF NOT EXISTS initial_password_enc text;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE buyer_accounts
      DROP COLUMN IF EXISTS initial_password_enc;
    `);
  }
}
