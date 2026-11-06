import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuyerAccounts1760000000032 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE buyer_accounts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        phone_e164 varchar(13) NOT NULL UNIQUE
          CHECK (phone_e164 ~ '^\\+996[1-9][0-9]{8}$'),
        display_name varchar(120) NOT NULL CHECK (length(trim(display_name)) >= 2),
        password_hash text NOT NULL,
        phone_verified_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE TABLE buyer_sessions (
        token_hash text PRIMARY KEY,
        buyer_id uuid NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX buyer_sessions_expiry ON buyer_sessions(expires_at);

      -- Unverified phone matches must never automatically grant buyers access
      -- to another shop's customer records. account_id remains NULL until a
      -- separate, verified, one-time account-linking flow is introduced.
      CREATE TABLE shop_customers (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL REFERENCES shops(id),
        phone_e164 varchar(13) NOT NULL
          CHECK (phone_e164 ~ '^\\+996[1-9][0-9]{8}$'),
        display_name varchar(120) NOT NULL CHECK (length(trim(display_name)) >= 2),
        address varchar(500),
        buyer_account_id uuid REFERENCES buyer_accounts(id) ON DELETE SET NULL,
        created_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (shop_id, id),
        UNIQUE (shop_id, phone_e164)
      );
      CREATE INDEX shop_customers_name_idx
        ON shop_customers(shop_id, lower(display_name));
      CREATE INDEX shop_customers_buyer_idx
        ON shop_customers(buyer_account_id)
        WHERE buyer_account_id IS NOT NULL;
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE shop_customers,buyer_sessions,buyer_accounts');
  }
}
