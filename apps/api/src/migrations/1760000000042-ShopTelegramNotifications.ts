import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopTelegramNotifications1760000000042 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS shop_telegram_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        chat_id bigint NOT NULL,
        telegram_user_id bigint,
        username text,
        first_name text,
        daily_shift_summary boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT shop_telegram_subscriptions_shop_chat_unique UNIQUE(shop_id, chat_id)
      );
      CREATE INDEX IF NOT EXISTS shop_telegram_subscriptions_shop_idx
        ON shop_telegram_subscriptions(shop_id);

      CREATE TABLE IF NOT EXISTS shop_telegram_link_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS shop_telegram_link_tokens_hash_idx
        ON shop_telegram_link_tokens(token_hash);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS shop_telegram_link_tokens;
      DROP TABLE IF EXISTS shop_telegram_subscriptions;
    `);
  }
}
