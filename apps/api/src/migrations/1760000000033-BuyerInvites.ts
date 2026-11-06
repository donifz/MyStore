import { MigrationInterface, QueryRunner } from 'typeorm';

export class BuyerInvites1760000000033 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE shop_customer_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        shop_id uuid NOT NULL,
        customer_id uuid NOT NULL,
        token_hash char(64) NOT NULL UNIQUE,
        issued_by uuid NOT NULL REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        accepted_at timestamptz,
        accepted_by uuid REFERENCES buyer_accounts(id),
        revoked_at timestamptz,
        FOREIGN KEY (shop_id,customer_id)
          REFERENCES shop_customers(shop_id,id),
        CHECK (expires_at > created_at),
        CHECK ((accepted_at IS NULL) = (accepted_by IS NULL)),
        CHECK (accepted_at IS NULL OR revoked_at IS NULL)
      );
      CREATE INDEX shop_customer_invites_customer
        ON shop_customer_invitations(shop_id,customer_id,created_at DESC);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE shop_customer_invitations');
  }
}
