import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuyerTelegramAuth1760000000041 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE buyer_telegram_auth_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token_hash char(64) NOT NULL UNIQUE,
        chat_id bigint,
        telegram_user_id bigint,
        phone_e164 varchar(13),
        buyer_id uuid REFERENCES buyer_accounts(id) ON DELETE CASCADE,
        session_token text,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        revoked_at timestamptz
      );
      CREATE INDEX buyer_telegram_auth_token_idx
        ON buyer_telegram_auth_requests(token_hash);
      CREATE INDEX buyer_telegram_auth_chat_idx
        ON buyer_telegram_auth_requests(chat_id)
        WHERE used_at IS NULL AND revoked_at IS NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE buyer_telegram_auth_requests');
  }
}
