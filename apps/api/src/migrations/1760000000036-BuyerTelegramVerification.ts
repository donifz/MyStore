import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuyerTelegramVerification1760000000036 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE buyer_accounts
        ADD COLUMN telegram_user_id bigint UNIQUE;

      CREATE TABLE buyer_telegram_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        buyer_id uuid NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        telegram_user_id bigint,
        chat_id bigint,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        revoked_at timestamptz,
        CHECK (expires_at > created_at),
        CHECK (used_at IS NULL OR revoked_at IS NULL)
      );
      CREATE INDEX buyer_telegram_verifications_pending
        ON buyer_telegram_verifications (buyer_id, created_at DESC)
        WHERE used_at IS NULL AND revoked_at IS NULL;
      CREATE INDEX buyer_telegram_verifications_chat
        ON buyer_telegram_verifications (telegram_user_id, chat_id)
        WHERE used_at IS NULL AND revoked_at IS NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE buyer_telegram_verifications');
    await q.query('ALTER TABLE buyer_accounts DROP COLUMN telegram_user_id');
  }
}
