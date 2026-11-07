import { MigrationInterface, QueryRunner } from 'typeorm';

export class LoyaltyWallets1760000000037 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE loyalty_wallets (
        shop_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        balance_points bigint NOT NULL DEFAULT 0
          CHECK (balance_points BETWEEN 0 AND 9007199254740991),
        PRIMARY KEY (shop_id, customer_id),
        FOREIGN KEY (shop_id, customer_id) REFERENCES shop_customers(shop_id, id)
      );
      CREATE TABLE loyalty_ledger (
        id uuid PRIMARY KEY,
        shop_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        sale_id uuid NOT NULL,
        kind text NOT NULL CHECK(kind IN ('earned','redeemed')),
        points bigint NOT NULL CHECK(points BETWEEN 1 AND 9007199254740991),
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY (shop_id, customer_id) REFERENCES loyalty_wallets(shop_id, customer_id),
        FOREIGN KEY (shop_id, sale_id) REFERENCES pos_sales(shop_id, document_id),
        UNIQUE (shop_id, sale_id, kind)
      );
      CREATE INDEX loyalty_ledger_customer_idx
        ON loyalty_ledger(shop_id, customer_id, created_at DESC);
      CREATE TRIGGER immutable_loyalty_ledger
        BEFORE UPDATE OR DELETE ON loyalty_ledger
        FOR EACH ROW EXECUTE FUNCTION deny_movement_changes();
      CREATE TABLE buyer_loyalty_tokens (
        token_hash char(64) PRIMARY KEY,
        buyer_id uuid NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        CHECK (expires_at > created_at)
      );
      CREATE INDEX buyer_loyalty_tokens_owner
        ON buyer_loyalty_tokens(buyer_id, created_at DESC);
    `);
  }
  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE buyer_loyalty_tokens');
    await q.query('DROP TABLE loyalty_ledger');
    await q.query('DROP TABLE loyalty_wallets');
  }
}
