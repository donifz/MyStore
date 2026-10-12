import { MigrationInterface, QueryRunner } from 'typeorm';
export class StaffEmail1760000000013 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(`
 CREATE TABLE staff_invitations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,email text NOT NULL,role text NOT NULL CHECK(role IN ('manager','cashier')),token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,used_at timestamptz,cancelled_at timestamptz,created_by uuid NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now());
 CREATE UNIQUE INDEX staff_pending ON staff_invitations(shop_id,email) WHERE used_at IS NULL AND cancelled_at IS NULL;
 CREATE TABLE password_resets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,used_at timestamptz,created_at timestamptz NOT NULL DEFAULT now());
 CREATE TABLE access_operations(scope text NOT NULL,key uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(scope,key));
 CREATE TABLE email_preferences(shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,orders boolean NOT NULL DEFAULT true,moderation boolean NOT NULL DEFAULT true,PRIMARY KEY(shop_id,user_id));
 CREATE TABLE email_deliveries(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),dedupe_key text NOT NULL UNIQUE,shop_id uuid REFERENCES shops(id) ON DELETE CASCADE,recipient text NOT NULL,payload jsonb,encrypted_payload text,secret_kind text CHECK(secret_kind IN ('staff','reset','partner')),secret_id uuid,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','failed','cancelled')),attempts int NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,lease_token uuid,message_id text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz,last_error text,CHECK((secret_kind IS NULL)=(secret_id IS NULL)));
 CREATE INDEX email_claim ON email_deliveries(available_at,created_at) WHERE status IN ('pending','sending');
 ALTER TABLE online_orders ADD COLUMN email text;
 ALTER TABLE outbox_events ADD COLUMN email_dispatch_enabled boolean NOT NULL DEFAULT true, ADD COLUMN email_expanded_at timestamptz;
 UPDATE outbox_events SET email_dispatch_enabled=false;
 `);
  }
  async down(q: QueryRunner) {
    await q.query(
      `ALTER TABLE outbox_events DROP COLUMN email_dispatch_enabled,DROP COLUMN email_expanded_at; ALTER TABLE online_orders DROP COLUMN email; DROP TABLE email_deliveries,email_preferences,access_operations,password_resets,staff_invitations;`,
    );
  }
}
